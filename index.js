var path = require('path'),
    Tree = require('./lib/tree.js'),
    packageCommonJs = require('./lib/runner/package-commonjs');

// API wrapper
function API() {
  this.files = new Tree();
  this.options = {};
}

API.prototype.include = function(filepath) {
  this.files.add(path.resolve(process.cwd(), filepath));
  return this;
};

API.prototype.render = function(dest) {
  if(typeof dest == 'function') {

  } else if(dest.write) {
    // writable stream
    packageCommonJs(this.files, this.options, dest);
  }
};

// NOPs

// setters
API.defaults = API.prototype.defaults = function(opts) {};
API.prototype.set = function(key, val) {};

['export', 'main'].forEach(function(key) {
  API.prototype[key] = function(value) {
    this.options[key] = value;
    return this;
  };
});

API.prototype.basepath = function(value) {
  path.resolve(process.cwd(), value);
  return this;
};

// other
API.prototype.replace = function(module, code) {
  return this;
};

API.prototype.exclude = function(path) {};
API.prototype.npm = function(name, pathTo) {};
API.prototype.handler = function(regex, fn) {};
API.prototype.define = function(module, code) {};
API.prototype.watch = function(onDone) {};
API.concat = function(arr, callback) {};

// deprecated
API.prototype.reqpath = function(value) {};

module.exports = API;
