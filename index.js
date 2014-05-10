var os = require('os'),
    fs = require('fs'),
    path = require('path'),
    runTasks = require('./lib/runner/transforms/index.js'),
    packageCommonJs = require('./lib/runner/commonjs2/index.js'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog'),
    Cache = require('minitask').Cache,
    log = require('minilog')('api'),
    ProgressBar = require('progress'),
    microee = require('microee'),
    PassThrough = require('readable-stream').PassThrough,
    runOnce = require('./lib/util/run-once.js'),
    resolveOpts = require('./lib/util/resolve-opts.js');

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
    // set options here so that the cache hash does not change
    jobs: require('os').cpus().length * 2
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
    if (input[key]) {
      opts[key] = resolveOpts.resolve(opts.basepath, opts[key]);
    }
  });

  // next, figure out the main file
  opts.main = resolveOpts.inferMain(input.main, opts.basepath, opts.include);

  ['include', 'exclude'].forEach(function(key) {
    if (input[key]) {
      opts[key] = resolveOpts.resolvePackage(opts.basepath, opts[key]);
    }
  });

  // process remap
  if (input.remap) {
    Object.keys(input.remap).forEach(function(key) {
      var code = input.remap[key];
      if (typeof code == 'object') {
        opts.remap[key] = JSON.stringify(code);
      } else {
        if (typeof key === 'string' && key.charAt(0) != '.' && key.charAt(0) != '/') {
          // exclude the module with the same name
          opts.exclude.push(key);
        }
        // function / number / boolean / undefined all convert to string already
        opts.remap[key] = code;
      }
    });
  }

  // console.log('Build options', opts);

  return opts;
};

// preRender performs all the file build tasks without actually producing an output file
// you can call this method on a build from, say, a fs.watch style tool to optimistically
// run builds.
//
API.prototype.preRender = function(opts, onDone) {
  var self = this;

  // normally called with one arg, but can skip resolveOptions when going via render()
  if (arguments.length < 2) {
    onDone = arguments[0];
    opts = this._resolveOptions(this.options);
  }

  // Create the shared cache instance
  var cache = Cache.instance({
    method: opts['cache-method'],
    path: opts['cache-path']
  });
  cache.begin();

  // run any tasks and parse dependencies (mapper)
  var runner = runTasks({
    cache: cache,
    include: opts.include,
    command: opts.command,
    transform: opts.transform,
    exclude: opts.exclude,
    ignore: opts.ignore,
    jobs: opts.jobs,
    'gluejs-version': opts['gluejs-version']
  }, function(err, files) {
    if (onDone) {
      onDone(err, files, runner);
    }
  });
  runner.on('parse-error', function(err) {
    self.emit('error', err);
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
  if (opts.progress) {
    require('./lib/reporters/progress.js')(runner);
  }
  if (opts.report) {
    require('./lib/reporters/size.js')(runner);
  }
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
    if (opts.etag && opts.etag == etag) {
      // if a etag is given, we don't even need to stream things off the disk
      if (dest !== process.stdout) {
        dest.end();
      }
      return true;
    } else if (fs.existsSync(cachedResult)) {
      fs.createReadStream(cachedResult).pipe(dest);
      return true; // dest.once('finish') handles the rest
    }
  }
  return false;
};

API.prototype.render = function(dest) {
  var self = this;

  // create a stream capturer if we want the result as callback result
  if (typeof dest == 'function') {
    // store the function - makes sure dest is always a writable stream
    var doneFn = dest,
        onDestEndFn = runOnce(function() {
          doneFn(null, capture.get());
        });

    dest = new Capture()
      .once('error', function(err) {
        console.error('Error in the capture stream: ', err);
        console.trace();
        doneFn(err, null);
      })
      .once('finish', onDestEndFn)
      .once('close', onDestEndFn);
  }
  var opts = this._resolveOptions(this.options);

  // cache instance
  var cache = Cache.instance({
    method: opts['cache-method'],
    path: opts['cache-path']
  });

  var expectedEndEvents = 1,
      seenEndEvents = 0;

  // set up the onDone tasks on the destination stream
  onDestEnd = runOnce(function() {
    cache.end();
    if (++seenEndEvents == expectedEndEvents) {
      self.emit('done');
    }
  });
  dest.once('finish', onDestEnd)
      .once('close', onDestEnd)
      .once('error', function(err) {
        cache.end();
        if (err) {
          self.emit('error', err);
          return;
        }
      });

  // Skip the whole build if: 1) no files have changed and 2) the etag matches
  if (opts.clean && opts.etag && this._streamEtag(opts.etag, dest)) {
    return;
  }

  // console.time('preRender');

  this.preRender(opts, function(err, files, runner) {

    // console.timeEnd('preRender');
    // console.time('render');

    runner.removeAllListeners();
    if (err) {
      self.emit('error', err);
      cache.end();
      return;
    }

    // calculate a etag for the result
    // best ensure that the files are in sorted order
    var etag = 'W/' + Cache.hash(JSON.stringify(files));

    // does a final build result with this etag exist?
    if (self._streamEtag(etag, dest)) {
      return;
    }
    // must emit before the destination stream/request has closed
    // could be moved somewhere better
    self.emit('etag', etag);

    // create a file that caches the result
    cachedResult = cache.filepath();
    // create a passthrough stream
    var splitter = new PassThrough(),
        cacheOut = fs.createWriteStream(cachedResult),
        hadError = false;

    // order matters here, prefer writing the cached output before the destination
    // so that requests made in rapid succession still hit the cache
    splitter.pipe(cacheOut);
    splitter.pipe(dest);

    self.once('error', function() {
      hadError = true;
    });

    expectedEndEvents++;

    var onCacheEnd = runOnce(function() {
      // finalize the cached result if there were no errors
      if (!hadError) {
        cache.data('etag-' + etag, cachedResult);
        log.debug('Cached etag:', etag, cachedResult);
      } else {
        log.debug('Skipped etag:', etag, 'due to error.');
      }
      if (++seenEndEvents == expectedEndEvents) {
        self.emit('done');
      }
    });

    cacheOut.once('finish', onCacheEnd).once('close', onCacheEnd);

    var packageCommonJs3 = require('./lib/runner/commonjs3');
    packageCommonJs3({
      files: files,
      out: splitter,
      basepath: opts.basepath,
      main: opts.main,
      export: opts['export'],
      umd: opts.umd,
      remap: opts.remap,
      'gluejs-version': opts['gluejs-version']
    });


/*
    // take the files and package them as a single file (reducer)
    packageCommonJs({
      cache: cache,
      files: files,
      out: splitter,
      basepath: opts.basepath,
      main: opts.main,
      export: opts['export'],
      umd: opts.umd,
      remap: opts.remap,
      'gluejs-version': opts['gluejs-version']
    });
*/
  });
};

// setters
API.prototype.set = function(key, value) {
  var self = this;
  // Input can be:
  // 1) key-value pair object
  if (arguments.length == 1 && key === Object(key)) {
    Object.keys(key).forEach(function(k) {
      this.set(k, key[k]);
    }, this);
    return this;
  }
  // 2) primitive <= set or append depending on the original value
  // 3) array <= set or append depending on the original value

  // original value can be:
  if (key == 'debug' && value) {
    Minilog.enable();
    Minilog.suggest.defaultResult = true;
    Minilog.suggest.clear();
  } else if (key == 'verbose' && value) {
    Minilog.enable();
    // enable logging levels >= info
    Minilog.suggest.defaultResult = false;
    Minilog.suggest.clear().allow(/.*/, 'info');
  } else if (Array.isArray(this.options[key])) {
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
  if (key == 'jobs') {
    log.info('Maximum number of parallel tasks:', this.options.jobs);
  }
  if (key == 'amd') {
    log.warn('The "--amd" option has been deprecated, please use "--umd" instead.');
  }
  if (key == 'replace') {
    log.warn('The "--replace" option has been deprecated, please use "--remap" instead.');
  }
  return this;
};

['export', 'main', 'exclude', 'basepath', 'remap', 'include'].forEach(function(key) {
  API.prototype[key] = function() {
    this.set.apply(this, [key].concat(Array.prototype.slice.call(arguments)));
    return this;
  };
});

// other
API.prototype.replace = function(module, code) {
  log.warn('The "--replace" option has been deprecated, please use "--remap" instead.');
  return this.remap(module, code);
};

// Express Middleware
API.middleware = require('./lib/middleware.js');

module.exports = API;
