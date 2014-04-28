var os = require('os'),
    path = require('path'),
    runTasks = require('./lib/runner/transforms/index.js'),
    packageCommonJs = require('./lib/runner/commonjs2/index.js'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog'),
    Cache = require('minitask').Cache,
    log = require('minilog')('api');

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

  if (!this.options.basepath) {
    this.options.basepath = Array.isArray(this.options.include) ?
      this.options.include[0] : this.options.include;
  } else {
    // resolve all relative includes
    this.options.include = (Array.isArray(this.options.include) ?
      this.options.include : [ this.options.include ]).map(function(filepath) {
        return path.resolve(self.options.basepath, filepath);
      });
  }


  // Create the shared cache instance
  var cacheHash = Cache.hash(JSON.stringify(this.options));
  var cache = Cache.instance({
    method: this.options['cache-method'],
    path: this.options['cache-path']
  });
  cache.begin();

  // run any tasks and parse dependencies (mapper)
  runTasks({
    cache: cache,
    include: this.options.include,
    command: this.options.command,
    transform: this.options.transform
    // TODO
    // --reset-exclude should also reset the pre-processing exclusion
    // if (this.options['reset-exclude']) {
    //   list.exclude(null);
    // }

    // list.onRename = function(canonical, normalized) {
    //   self.options._rename[normalized] = canonical;
    // };

  }, function(err, files) {
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
      basepath: self.options['basepath'],
      main: self.options['main'],
      export: self.options['export'],
      umd: self.options['umd'],
      remap: self.options.remap,
    }, function(err, results) {
      cache.end();
    });
  });
};

// setters
API.prototype.set = function(key, value) {
  this.options[key] = value;
  if (key == 'verbose' && value) {
    Minilog.enable();
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
  if (!this.options['exclude']) {
    this.options['exclude'] = [];
  }
  this.options['exclude'].push((path instanceof RegExp ? path : new RegExp(path)));
  return this;
};

// Express Middleware
API.middleware = function(opts) {

  // -- Set some sane defaults
  opts = opts || {};
  opts.include = opts.include || './lib';
  if (!opts.basepath) {
    opts.basepath = Array.isArray(opts.include) ? opts.include[0] : opts.include;
  }
  opts.main = opts.main || 'index.js';

  // -- Create an instance of the API to use
  var glue = new API()
    .include(opts.include)
    .basepath(opts.basepath);

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
