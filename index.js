var os = require('os'),
    fs = require('fs'),
    path = require('path'),
    runTasks = require('./lib/runner/transforms/index.js'),
    packageCommonJs = require('./lib/runner/commonjs2/index.js'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog'),
    Cache = require('minitask').Cache,
    log = require('minilog')('api'),
    ProgressBar = require('progress');

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

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

API.prototype.include = function(filepath) {
  if (!filepath) return this;
  this.options.include.push(filepath);
  return this;
};

API.prototype.render = function(dest) {
  var self = this;
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

  // Create the shared cache instance
  var cacheHash = Cache.hash(JSON.stringify(this.options));
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
    ignore: this.options.ignore
    // TODO
    // --reset-exclude should also reset the pre-processing exclusion
    // if (this.options['reset-exclude']) {
    //   list.exclude(null);
    // }

    // list.onRename = function(canonical, normalized) {
    //   self.options._rename[normalized] = canonical;
    // };

  }, function(err, files) {
    // tj's progress can make the process hang (!) if the total count is off due to exclusions
    if (progress && progress.rl && progress.rl.close) {
      progress.rl.close();
    }

    // create a stream capturer if we want the result as callback result
    var capture;
    if (typeof dest == 'function') {
      capture = new Capture();

      capture.on('error', function(err) {
        console.error('Error in the capture stream: ', err);
        console.trace();
      });

      capture.once('finish', function() {
        dest(null, capture.get());
      });
    }

    // take the files and package them as a single file (reducer)
    packageCommonJs({
      cache: cache,
      files: files,
      out: capture ? capture : dest,
      basepath: self.options.basepath,
      main: self.options.main,
      export: self.options['export'],
      umd: self.options.umd,
      remap: self.options.remap,
    }, function(err, results) {
      cache.end();
    });
  });

  runner.on('add', function(filename) {
    progress.total += 1;
  });
  runner.on('hit', function(filename) {
    progress.complete++;
    progress.hits++;
  });
  runner.on('miss', function(filename) {
    progress.complete++;
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

// setters
API.prototype.set = function(key, value) {
  this.options[key] = value;
  if (key == 'verbose' && value) {
    Minilog.enable();
  }
  if (key == 'exclude' && value) {
    this.options['exclude'].push((value instanceof RegExp ? value: new RegExp(value)));
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
  if (arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.replace(k, module[k]);
    }, this);
  } else {
    // TODO: exclude the module with the same name
    if (typeof code == 'object') {
      this.options.replaced[module] = JSON.stringify(code);
    } else {
      // function / number / boolean / undefined all convert to string already
      this.options.replaced[module] = code;
    }
  }

  return this;
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
      // function / number / boolean / undefined all convert to string already
      this.options.remap[module] = code;
    }
  }
  return this;
};

API.prototype.exclude = function(path) {
  this.set('exclude', path);
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
    glue.render(res);
  };
};

module.exports = API;
