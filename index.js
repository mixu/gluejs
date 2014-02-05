var os = require('os'),
    path = require('path'),
    List = require('minitask').list,
    packageCommonJs = require('./lib/runner/package-commonjs'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog');

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = homepath ? path.normalize(homePath) : process.cwd();

// API wrapper
function API() {
  this.files = new List();
  // exclude matching paths from traversal - this is applied during the
  // initial traversal because going into source control directories is
  // potentially very expensive
  this.files.exclude([
    function(p) { return p.match(/\/.svn/); },
    function(p) { return p.match(/\/.git/); },
    function(p) { return p.match(/\/.hg/); },
    function(p) { return p.match(/\/CVS/); }
  ]);

  // default options
  this.options = {
    replaced: {},
    remap: {},
    cache: true,
    'cache-path': homePath + path.sep + '.gluejs-cache' + path.sep
  };
}

API.prototype.include = function(filepath) {
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]),
      base = this.options.basepath || process.cwd();

  paths.forEach(function(p) {
    self.files.add(path.resolve(base, p));
  });
  return this;
};

API.prototype.render = function(dest) {
  // if the cache is disabled, then use a temp path
  if(!this.options.cache) {
    this.options['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
  }

  if(typeof dest == 'function') {
    var capture = new Capture();

    capture.on('error', function(err) {
      console.error('Error in the capture stream: ', err);
      console.trace();
    });

    capture.once('finish', function() {
      dest(null, capture.get());
    });

    packageCommonJs(this.files, this.options, capture, function() {
      // NOP
    });
  } else if(dest.write) {
    // writable stream
    packageCommonJs(this.files, this.options, dest, function() {
      // if(dest !== process.stdout) {
      //   dest.end();
      // }
    });
  }
};

// setters
API.defaults = API.prototype.defaults = function(opts) {};
API.prototype.set = function(key, value) {
  this.options[key] = value;
  if(key == 'verbose' && value) {
    Minilog.enable();
  }
  // --reset-exclude should also reset the pre-processing exclusion
  // which prevent
  if(key == 'reset-exclude' && value) {
    this.files.exclude(null);
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
  if(arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.replace(k, module[k]);
    }, this);
  } else {
    // TODO: exclude the module with the same name
    if(typeof code == 'object') {
      this.options.replaced[module] = JSON.stringify(code);
    } else {
      // function / number / boolean / undefined all convert to string already
      this.options.replaced[module] = code;
    }
  }

  return this;
};

API.prototype.remap = function(module, code) {
  if(arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.remap(k, module[k]);
    }, this);
  } else {
    if(typeof code == 'object') {
      this.options.remap[module] = JSON.stringify(code);
    } else {
      // function / number / boolean / undefined all convert to string already
      this.options.remap[module] = code;
    }
  }
  return this;
};


API.prototype.exclude = function(path) {
  if(!this.options['exclude']) {
    this.options['exclude'] = [];
  }
  this.options['exclude'].push((path instanceof RegExp ? path : new RegExp(path)));
  return this;
};

// Express Middleware
API.middleware = function (opts) {

  // -- Set some sane defaults
  opts = opts || {};
  opts.include = opts.include || './lib';
  if(!opts.basepath) {
    opts.basepath = Array.isArray(opts.include) ? opts.include[0] : opts.include;
  }
  opts.main = opts.main || 'index.js';

  // -- Create an instance of the API to use
  var glue = new API()
    .include(opts.include)
    .basepath(opts.basepath || './lib');

  // -- All other options are set by clobbering the glue.options hash
  Object.keys(opts).forEach(function (key) {
    glue.set(key, opts[key]);
  });

  // -- Middleware to return
  return function (req, res, next) {

    // -- Return all non GET requests
    if('GET' !== req.method) return next();

    // -- Set content-type
    res.set('Content-Type', 'application/javascript');

    // -- Render file and pipe to response
    glue.render(res);
  };
};

API.prototype.handler = function(regex, fn) {};
API.prototype.define = function(module, code) {};
API.prototype.watch = function(onDone) {};

// deprecated
API.prototype.npm = function(name, pathTo) {};
API.prototype.reqpath = function(value) {};
API.concat = function(arr, callback) {};

module.exports = API;
