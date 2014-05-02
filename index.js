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
    PassThrough = require('readable-stream').PassThrough;

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

// need to run some callbacks just once, avoid littering the code with tiny booleans
function runOnce(fn) {
  var ran = false;
  return function() {
    if (!ran) {
      fn.apply(fn, Array.prototype.slice(arguments));
    }
  };
}

// API wrapper
function API() {
  // default options
  this.options = {
    replaced: {},
    remap: {},
    cache: true,
    'cache-path': homePath + path.sep + '.gluejs-cache' + path.sep,
    include: [],
    exclude: [],
    // set options here so that the cache hash does not change
    jobs: require('os').cpus().length * 2
  };
}

microee.mixin(API);

API.prototype.include = function(filepath) {
  if (!filepath) return this;
  this.options.include.push(filepath);
  return this;
};

// options need to be resolved just before running, since their results
// depend on the state of the file system (ex. `include()` on a folder that has changed)
//
API.prototype._resolveOptions = function() {
  // if the cache is disabled, then use a temp path
  if (!this.options.cache) {
    this.options['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
  }

  if (!this.options['cache-method']) {
    this.options['cache-method'] = 'stat';
  }

  var firstInclude = (typeof this.options.include === 'string' ?
        this.options.include : this.options.include[0]),
      firstIncludeStat = (fs.existsSync(firstInclude) ? fs.statSync(firstInclude) : false);

  // if basepath is not set, use the firstInclude to set it
  if (!this.options.basepath) {
    this.options.basepath = (firstIncludeStat && firstIncludeStat.isFile() ?
      path.dirname(firstInclude) : firstInclude);
  }
  // set main the first include is a file, use it as the main
  // otherwise, warn?
  if (!this.options.main && firstIncludeStat && firstIncludeStat.isFile()) {
    this.options.main = path.relative(this.options.basepath, firstInclude);
  }

  function resolve(to, from) {
    return (Array.isArray(from) ? from : [ from ]).map(function(relpath) {
      // skip non-relative paths (this keeps external module names plain)
      return (relpath.charAt(0) == '.' ? path.resolve(to, relpath) : relpath);
    });
  }

  // resolve relative ignores
  if (this.options.ignore) {
    this.options.ignore = resolve(this.options.basepath, this.options.ignore);
  }

  // resolve all relative includes
  this.options.include = resolve(this.options.basepath, this.options.include);

  function resolvePackage(to, from) {
    var nodeResolve = require('resolve');
    return (Array.isArray(from) ? from : [ from ]).map(function(dep) {
      if (dep.charAt(0) == '.' || dep.charAt(0) == '/') {
        return dep;
      }
      return nodeResolve.sync(dep, { basedir: to });
    });
  }

  this.options.include = resolvePackage(this.options.basepath, this.options.include);
};

// preRender performs all the file build tasks without actually producing an output file
// you can call this method on a build from, say, a fs.watch style tool to optimistically
// run builds.
//
API.prototype.preRender = function(onDone) {
  var self = this;

  this._resolveOptions();

  // Create the shared cache instance
  var cache = Cache.instance({
    method: this.options['cache-method'],
    path: this.options['cache-path']
  });
  cache.begin();

  // console.log('Build options', this.options);

  // reporters
  var progress = { total: 0, complete: 0, hit: 0, miss: 0 };
  // run any tasks and parse dependencies (mapper)
  var runner = runTasks({
    cache: cache,
    include: this.options.include,
    command: this.options.command,
    transform: this.options.transform,
    exclude: this.options.exclude,
    ignore: this.options.ignore,
    jobs: this.options.jobs
    // TODO
    // --reset-exclude should also reset the pre-processing exclusion
    // if (this.options['reset-exclude']) {
    //   list.exclude(null);
    // }
  }, function(err, files) {
    // tj's progress can make the process hang (!) if the total count is off due to exclusions
    if (progress && progress.rl && progress.rl.close) {
      progress.rl.close();
    }
    if (onDone) {
      onDone(err, files, runner);
    }
  });
  runner.on('parse-error', function(err) {
    self.emit('error', err);
  });

  runner.on('add', function(filename) {
    progress.total += 1;
    self.emit('add', filename);
  });
  runner.on('hit', function(filename) {
    progress.hit++;
    progress.complete++;
    self.emit('hit', filename);
  });
  runner.on('miss', function(filename) {
    progress.complete++;
    self.emit('miss', filename);
  });
  runner.once('done', function() {
    console.log(progress.complete + ' of ' + progress.total +
        ' (cache hits: ' + progress.hit + ')');
  });

  if (process.stderr.isTTY || this.options.progress) {
    // progress = new ProgressBar('[:bar] :current / :total :percent :etas', {
    //   complete: '=', incomplete: ' ', width: 20, total: 1
    // });
    var pending = [];
    runner.on('hit', function(filename) {
      process.stderr.clearLine();
      process.stderr.cursorTo(0);
      process.stderr.write(progress.complete + ' of ' + progress.total +
        ' (cache hits: ' + progress.hit + ')');
      // progress.tick();
    });
    runner.on('miss', function(filename) {
      process.stderr.clearLine();
      process.stderr.cursorTo(0);
      process.stderr.write(progress.complete + ' of ' + progress.total +
        ' (cache hits: ' + progress.hit + ')');
      // progress.tick();
    });
  }
};

API.prototype.render = function(dest) {
  var self = this;

  // create a stream capturer if we want the result as callback result
  if (typeof dest == 'function') {
    // store the function - makes sure dest is always a writable stream
    var doneFn = dest,
        onDestEnd = runOnce(function() {
          doneFn(null, capture.get());
        });

    dest = new Capture()
      .once('error', function(err) {
        console.error('Error in the capture stream: ', err);
        console.trace();
        doneFn(err, null);
      })
      .once('finish', onDestEnd)
      .once('close', onDestEnd);
  }

  // allow the build to be skipped if:
  // 1) does a build with this etag exist? `etag` option
  // 2) you be certain that the input files and directories are
  // all in the same state (e.g. due to a watcher)? `skipBuild` option
  if (false && this.options.canSkipBuild) {
    // read from cache
    // create a stream capturer if we want the result as callback result
    // emit done
  }

  // otherwise we need to do cache lookups for each invidual file,
  // which will reuse results for any file that has not been changed
  // but comes at the cost of doing real fs operations.

  // console.time('preRender');

  this.preRender(function(err, files, runner) {

    // console.timeEnd('preRender');
    // console.time('render');

    var cache = Cache.instance({
      method: self.options['cache-method'],
      path: self.options['cache-path']
    });
    runner.removeAllListeners();
    if (err) {
      self.emit('error', err);
      cache.end();
      return;
    }

    // set up the onDone tasks on the destination stream
    var onDestEnd = runOnce(function() {
      cache.end();
      // console.timeEnd('render');
      self.emit('done');
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

    // calculate a etag for the result
    // best ensure that the files are in sorted order
    var etag = Cache.hash(JSON.stringify(files));

    // does a final build result with this etag exist?
    // if yes, return the cached version
    var cachedResult = cache.data('etag-' + etag);
    if (cachedResult && fs.existsSync(cachedResult)) {
      fs.createReadStream(cachedResult).pipe(dest);
      return; // dest.once('finish') handles the rest
    }

    // create a file that caches the result
    cachedResult = cache.filepath();
    // create a passthrough stream
    var splitter = new PassThrough(),
        cacheOut = fs.createWriteStream(cachedResult),
        hadError = false;
    splitter.pipe(dest);
    splitter.pipe(cacheOut);

    self.once('error', function() {
      hadError = true;
    });

    var onCacheEnd = runOnce(function() {
      // finalize the cached result if there were no errors
      if (!hadError) {
        cache.data('etag-' + etag, cachedResult);
        log.debug('Cached etag:', etag, cachedResult);
      } else {
        log.debug('Skipped etag:', etag, 'due to error.');
      }
    });

    cacheOut.once('finish', onCacheEnd).once('close', onCacheEnd);

    // take the files and package them as a single file (reducer)
    packageCommonJs({
      cache: cache,
      files: files,
      out: splitter ? splitter : dest,
      basepath: self.options.basepath,
      main: self.options.main,
      export: self.options['export'],
      umd: self.options.umd,
      remap: self.options.remap,
    });
  });
};

// setters
API.prototype.set = function(key, value) {
  if (key == 'exclude' && value) {
    this.options['exclude'].push(value);
  } else {
    this.options[key] = value;
  }
  if (key == 'verbose' && value) {
    Minilog.enable();
    // enable logging levels >= info
    Minilog.suggest.defaultResult = false;
    Minilog.suggest.clear().allow(/.*/, 'info');
  }
  if (key == 'jobs') {
    log.info('Maximum number of parallel tasks:', this.options.jobs);
  }
  return this;
};

['export', 'main'].forEach(function(key) {
  API.prototype[key] = function(value) {
    this.options[key] = value;
    return this;
  };
});

API.prototype.basepath = function(value) {
  this.options.basepath = path.resolve(process.cwd(), value);
  return this;
};

// other
API.prototype.replace = function(module, code) {
  log.warn('The "--replace" option has been deprecated, please use "--remap" instead.');
  return this.remap(module, code);
};

API.prototype.remap = function(module, code) {
  if (arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.remap(k, module[k]);
    }, this);
  } else {
    if (typeof code == 'object') {
      this.options.remap[module] = JSON.stringify(code);
    } else {
      if (typeof module === 'string' && module.charAt(0) != '.' && module.charAt(0) != '/') {
        // exclude the module with the same name
        this.set('exclude', module);
      }
      // function / number / boolean / undefined all convert to string already
      this.options.remap[module] = code;
    }
  }
  return this;
};

// TODO cleanup
// set('exclude') uses direct set, this one converts to regExp
API.prototype.exclude = function(path) {
  this.set('exclude', path instanceof RegExp ? path: new RegExp(path));
  return this;
};

// Express Middleware
API.middleware = function(opts) {
  // allow .middleware(str|arr, opts)
  if (arguments.length === 2) {
    var args = Array.prototype.slice.call(arguments);
    opts = args[1];
    opts.include = args[0];
  } else if (typeof opts === 'string' || Array.isArray(opts)) {
    opts = { include: opts };
  }
  // -- Set some sane defaults
  opts = opts || {};
  opts.include = opts.include || './lib';

  // -- Create an instance of the API to use
  var glue = new API()
    .include(opts.include);

  // -- All other options are set by clobbering the glue.options hash
  Object.keys(opts).forEach(function(key) {
    glue.set(key, opts[key]);
  });

  // -- Middleware to return
  return function(req, res, next) {

    // -- Return all non GET requests
    if ('GET' !== req.method) return next();

    // -- Set content-type
    res.setHeader('Content-Type', 'application/javascript');

    // -- Render file and pipe to response
    glue
      .on('error', function(err) {
        var strErr = err.toString(),
            reqUrl = (req.originalUrl ? req.originalUrl : req.url);
        if (err.path || err.fileName) {
          strErr = '[' + (err.path || err.fileName) +
            ':' + err.lineNumber +
            ':' + err.column + '] '
            + err.message;
        }

        log.error('gluejs middleware: ' + reqUrl + ' returning 500 due to error: ', err);
        res.statusCode = 500;
        res.write('console.error("[500] gluejs build error (at: ' +
          req.protocol + '://' + req.host + reqUrl + '):\\n      ", ' +
          JSON.stringify(strErr) + ');\n');
        res.end();
      })
      .render(res);
  };
};

module.exports = API;
