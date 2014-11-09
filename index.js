var os = require('os'),
    fs = require('fs'),
    path = require('path'),
    runTasks = require('transform-runner'),
    packageCommonJs = require('./lib/commonjs'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog'),
    Cache = require('minitask').Cache,
    log = require('minilog')('api'),
    microee = require('microee'),
    runOnce = require('./lib/util/run-once.js'),
    resolveOpts = require('./lib/util/resolve-opts.js'),
    cacheSplitter = require('./lib/file-tasks/splitter.js');

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

// API wrapper
function API() {
  // default options
  this.options = {
    remap: {},
    cache: true,
    'cache-path': homePath + path.sep + '.gluejs-cache' + path.sep,
    'cache-method': 'stat',
    include: [],
    exclude: [],
    ignore: [],
    command: [],
    transform: [],
    'global-command': [],
    'global-transform': [],
    log: 'warn',
    // set options here so that the cache hash does not change
    jobs: os.cpus().length * 2,
    // set this so that builds are invalidated as the version changes
    'gluejs-version': require('./package.json').version
  };
}

microee.mixin(API);

// options need to be resolved just before running, since their results
// depend on the state of the file system (ex. `include()` on a folder that has changed)
//
API.prototype._resolveOptions = function(input) {
  var opts = { };
  // copy each input key, overwrite later
  Object.keys(input).forEach(function(key) {
    opts[key] = input[key];
  });

  // if the cache is disabled, then use a temp path
  if (!input.cache) {
    opts['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
  }

  // first priority is to figure out what the base path is
  opts.basepath = resolveOpts.inferBasepath(input.basepath, input.include);

  // next, resolve relative: --ignore, --include and --exclude
  ['ignore', 'include', 'exclude'].forEach(function(key) {
    if (!input[key]) {
      return;
    }
    if (key === 'include' || key == 'ignore') {
      opts[key].forEach(function(item) {
        if (typeof item !== 'string') {
          throw new Error('Includes and ignores must be strings - any regular expressions ' +
            'must be applied as exclusions after including a set of files/directories.');
        }
      });
    }
    // handle package references
    opts[key] = opts[key].map(function(str) {
      if (typeof str !== 'string' || str.charAt(0) == '/') {
        return str;
      } else if (str.charAt(0) == '.') {
        // resolve non-packages to their full paths
        return path.resolve(opts.basepath, str);
      }
      if (key === 'include') {
        // include package => resolve actual package root and include it + all deps
        return resolveOpts.resolvePackage(opts.basepath, str);
      } else if (key === 'ignore') {
        // ignore package => add a remap expression for the package + add the package itself
        // so we can detect references to it later
        opts.remap[str] = '{}';
        return resolveOpts.getPackageRoot(opts.basepath, str);
      } else if (key === 'exclude') {
        // exclude or ignore package => resolve package root folder and exclude it + subpath
        return resolveOpts.getPackageRoot(opts.basepath, str);
      }
    }).filter(Boolean);
  });

  // next, figure out the main file
  opts.main = resolveOpts.inferMain(opts.basepath, opts.include);

  // process remap
  if (input.remap) {
    Object.keys(input.remap).forEach(function(name) {
      var code = input.remap[name];
      opts.remap[name] = (typeof code == 'object' ? JSON.stringify(code) : code);
      // add an exclusion for the remapped file, or the remapped package
      if (name.charAt(0) != '.' && name.charAt(0) != '/') {
        opts.exclude.push(resolveOpts.getPackageRoot(opts.basepath, name));
      } else {
        opts.exclude.push((name.charAt(0) == '.' ? path.resolve(opts.basepath, name) : name));
      }
    });
    opts.exclude = opts.exclude.filter(Boolean);
  }

  return opts;
};

API.prototype._streamEtag = function(etag, dest) {
  var opts = this._resolveOptions(this.options);
  var cache = Cache.instance({
    method: opts['cache-method'],
    path: opts['cache-path']
  });
  var cachedResult = cache.data('etag-' + etag);
  if (cachedResult) {
    this.emit('etag', etag);
    if (opts.etag && opts.etag == etag && fs.existsSync(cachedResult)) {
      // if a etag is given, we don't even need to stream things off the disk
      // However, check that the cached file exists. Otherwise we may get into a standoff
      // where the browser has a cached version which we never invalidate, even if the
      // cache is emptied.
      if (dest !== process.stdout) {
        dest.end();
      }
      log.info('Etag match for (' + etag + '): sending 0 byte response.');
      return true;
    } else if (fs.existsSync(cachedResult)) {
      fs.createReadStream(cachedResult).pipe(dest);
      log.info('Cached build match for (' + etag + '): using cached file.');
      return true; // dest.once('finish') handles the rest
    }
  }
  return false;
};

// you can call this method without a `DEST` on a build from,
// say, a fs.watch style tool to optimistically run builds.

API.prototype.render = function(dest) {
  var self = this,
      expectedEndEvents = 1,
      seenEndEvents = 0,
      opts = this._resolveOptions(this.options),
      cache = Cache.instance({
        method: opts['cache-method'],
        path: opts['cache-path']
      });

  log.info('Build options', opts);

  function onErr(err) {
    if (err) {
      self.emit('error', err);
      cache.end();
    }
  }

  // create a stream capturer if we want the result as callback result
  if (typeof dest == 'function') {
    dest = new Capture().wrap(dest);
  }

  // set up the onDone tasks on the destination stream
  var onDestEnd = runOnce(function() {
    cache.end();
    if (++seenEndEvents == expectedEndEvents) {
      self.emit('done');
    }
  });
  dest.once('finish', onDestEnd)
      .once('close', onDestEnd)
      .once('error', onErr);

  // Skip the whole build if: 1) no files have changed and 2) the etag matches
  if (opts.clean && opts.etag && this._streamEtag(opts.etag, dest)) {
    return;
  }

  cache.begin();

  // cache hash (only options which affect the build invalidation (at this level)
  var invalidationOpts = {};
  ['include', 'command', 'transform', 'exclude', 'ignore',
   'gluejs-version'].forEach(function(key) {
    invalidationOpts[key] = opts[key];
  });

  // run any tasks and parse dependencies (mapper)
  var runner = runTasks({
    // new API
    tasks: require('./lib/transform-runner/get-tasks.js')({
      cache: cache,
      command: opts.command,
      'global-command': opts['global-command'],
      transform: opts.transform,
      'global-transform': opts['global-transform'],
      basepath: opts.basepath
    }),

    cache: require('./lib/transform-runner/wrap-cache.js')(cache, cache.hash(JSON.stringify(invalidationOpts))),

    log: Minilog('runner'),

    // old
    include: opts.include,
    exclude: opts.exclude,
    ignore: opts.ignore,
    jobs: opts.jobs
  });
  // parse errors should not be considered errors - they will stop the
  // middleware from producing output
  runner.on('parse-error', function(err) {
    self.emit('warn', err);
  });
  runner.on('file', function(filename) {
    self.emit('file', filename);
  });
  runner.on('hit', function(filename) {
    self.emit('hit', filename);
  });
  runner.on('miss', function(filename) {
    self.emit('miss', filename);
  });

  if (opts.log === 'debug') {
    runner.on('file-done', function(filename, result) {
      log.info('Result:', filename, result);
    });
  }

  if (opts.progress) {
    require('./lib/reporters/progress.js')(runner);
  }
  if (opts.report) {
    require('./lib/reporters/size.js')(runner);
  }

  runner.once('done', function(err, files) {
    if (err) {
      return onErr(err);
    }

    // best ensure that the files are in sorted order
    files.sort(function(a, b) { return a.filename.localeCompare(b.filename); });

    if (opts.list) {
      files
        .map(function(file) { return file.filename; })
        .forEach(function(name) { console.error(name); }); // log to stderr
    }

    // calculate a etag for the result
    // this should be invalidated if:
    // - the set of files changes
    // - the size of any of the files changes
    // - the date modified of any of the files changes
    // - any of the build options change
    var config = [
          'basepath', 'command', 'exclude', 'export',
          'gluejs-version', 'ignore', 'include', 'main',
          'remap', 'source-map', 'transform', 'umd'
        ].reduce(function(prev, key) {
          prev[key] = opts[key];
          return prev;
        }, {}),
        cacheStr = JSON.stringify(config);

    files.forEach(function(file, index) {
      cacheStr += file.filename + '-' + cache.file(file.filename).sig() + '\n';
    });
    var etag = 'W/' + Cache.hash(cacheStr),
        hadError = false;

    // is `dest` not set? => used to skip the latter half of the build, for heating up the
    // cache when using a file watcher
    // OR: does a final build result with this etag exist?
    if (!dest || self._streamEtag(etag, dest)) {
      return;
    }
    // must emit before the destination stream/request has closed
    // could be moved somewhere better
    self.emit('etag', etag);

    self.once('error', function() {
      hadError = true;
    });

    expectedEndEvents++;

    config.files = files;
    config.out = cacheSplitter(cache.filepath(), dest, function(err, cacheFile) {
      // finalize the cached result if there were no errors
      if (!hadError) {
        cache.data('etag-' + etag, cacheFile);
        log.debug('Cached etag:', etag, cacheFile);
      } else {
        log.debug('Skipped etag:', etag, 'due to error.');
      }
      if (++seenEndEvents == expectedEndEvents) {
        self.emit('done');
      }
    });

    packageCommonJs(config);
  });
  // start the queue
  runner.exec();
};

// setters
API.prototype.set = function(key, value) {
  var self = this;
  // Input can be:
  // 1) key-value pair object
  if (arguments.length == 1 && key === Object(key)) {
    // set the logging level first
    if (key['log']) {
      this.set('log', key['log']);
    }
    Object.keys(key).forEach(function(k) {
      self.set(k, key[k]);
    });
    return this;
  }
  // 2) primitive <= set or append depending on the original value
  // 3) array <= set or append depending on the original value

  // original value can be:
  if (key === 'verbose' && value) {
    key = 'log';
    value = 'info';
  }
  if (key == 'jobs') {
    log.info('Maximum number of parallel tasks:', this.options.jobs);
  }
  if (key == 'debug' && value) {
    key = 'log';
    value = 'debug';
  }
  if (key == 'source-url') {
    log.warn('The "--source-url" option has been deprecated, please use "--source-map" instead.');
    key = 'source-map';
  }
  if (key == 'amd') {
    log.warn('The "--amd" option has been deprecated, please use "--umd" instead.');
    key = 'umd';
  }
  if (key == 'replace') {
    log.warn('The "--replace" option has been deprecated, please use "--remap" or "--ignore" instead.');
    key = 'remap';
  }
  if (key == 'exclude-regexp') {
    key = 'exclude';
    if (typeof value === 'string') {
      value = new RegExp(value);
    }
  }
  if (key == 'insert-globals' && value) {
    return this.set('transform', 'insert-module-globals');
  }

  if (key == 'log' && value) {
    if (process.stdout.isTTY) {
      Minilog.enable();
    } else {
      Minilog.pipe(Minilog.suggest).pipe(new Minilog.Stringifier()).pipe(process.stdout);
    }

    if (['info', 'warn', 'error'].indexOf(value) > -1) {
      // enable logging levels >= info
      Minilog.suggest.defaultResult = false;
      Minilog.suggest.clear().allow(/.*/, value);
    } else if (value === 'debug') {
      Minilog.suggest.defaultResult = true;
      Minilog.suggest.clear();
    }
  }
  if (Array.isArray(this.options[key])) {
    // 1) an array <= append to array
    if (Array.isArray(value)) {
      this.options[key] = this.options[key].concat(value);
    } else {
      this.options[key].push(value);
    }
  } else if (this.options[key] && typeof this.options[key] == 'object') {
    // 2) an object
    //   <= for two params, set key and value
    //   <= for an object param, iterate keys and values and set them
    // keyName, arg1, arg2
    if (arguments.length === 3) {
      this.options[key][arguments[1]] = arguments[2];
    } else if (arguments.length === 2 &&
      value && typeof value === 'object') {
      Object.keys(value).forEach(function(oKey) {
        self.options[key][oKey] = value[oKey];
      });
    } else {
      throw new Error('Unknown option format for key "' + key + '": ' +
        Array.prototype.slice.call(arguments));
    }
  } else {
    // 3) a primitive <= overwrite
    this.options[key] = value;
  }
  return this;
};

['export', 'exclude', 'basepath', 'remap', 'include'].forEach(function(key) {
  API.prototype[key] = function() {
    this.set.apply(this, [key].concat(Array.prototype.slice.call(arguments)));
    return this;
  };
});

// other
API.prototype.main = function(path) {
  log.warn('The "--main" option has been deprecated, the first --include file is set as the main.');
  return this.set('include', path);
};

API.prototype.replace = function(module, code) {
  log.warn('The "--replace" option has been deprecated, please use "--remap" instead.');
  return this.set('remap', module, code);
};

// Express Middleware
API.middleware = require('./lib/middleware.js');

module.exports = API;
