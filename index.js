var path = require('path'),
    List = require('minitask').list,
    packageCommonJs = require('./lib/runner/package-commonjs'),
    Capture = require('./lib/file-tasks/capture.js'),
    Minilog = require('minilog');

// API wrapper
function API() {
  this.files = new List();
  // default options
  this.options = {
    replaced: {}
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
  if(typeof dest == 'function') {
    var capture = new Capture();
    packageCommonJs(this.files, this.options, capture, function() {
      dest(null, capture.get());
    });
  } else if(dest.write) {
    // writable stream
    packageCommonJs(this.files, this.options, dest, function() {
      if(dest !== process.stdout) {
        dest.end();
      }
    });
  }
};

// NOPs

// setters
API.defaults = API.prototype.defaults = function(opts) {};
API.prototype.set = function(key, value) {
  this.options[key] = value;
  if(key == 'verbose') {
    Minilog.enable();
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

API.prototype.exclude = function(path) {
  if(!this.options['exclude']) {
    this.options['exclude'] = [];
  }
  this.options['exclude'].push((path instanceof RegExp ? path : new RegExp(path)));
  return this;
};
API.prototype.handler = function(regex, fn) {};
API.prototype.define = function(module, code) {};
API.prototype.watch = function(onDone) {};

// deprecated
API.prototype.npm = function(name, pathTo) {};
API.prototype.reqpath = function(value) {};
API.concat = function(arr, callback) {};

module.exports = API;
