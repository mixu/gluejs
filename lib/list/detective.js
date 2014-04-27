var fs = require('fs'),
    path = require('path'),
    detective = require('detective'),
    resolve = require('browser-resolve'),
    nodeResolve = require('resolve'),
    List = require('minitask').list,
    Cache = require('minitask').Cache,
    log = require('minilog')('parse');

function DetectiveList(opts) {
  List.apply(this, Array.prototype.slice.call(arguments));

  this._resolveErrors = [];

  var cache = Cache.instance({
      method: opts['cache-method'],
      path: opts['cache-path']
  });

  var depKey = opts['cache-hash'] + '-dependencies',
      resultKey = opts['cache-hash'] + '-dependencies-norm',
      renameKey = opts['cache-hash'] + '-dependencies-rename';

  log.debug('Cache:', opts['cache-method'], opts['cache-path'], opts['cache-hash']);

  // replace the find function to use node-detective
  this.find(function(filepath, stat, onDone) {
     var self = this;
    detectiveDependencies(filepath, cache, function(canonical, normalized) {
      self.onRename(canonical, normalized);
    }, function(err, dependencies) {
      if (err) {
        self._resolveErrors = self._resolveErrors.concat(err);
      }
      onDone(null, dependencies);
    });
  });
}

DetectiveList.prototype = new List();

DetectiveList.prototype.resolveErrors = function() {
 return this._resolveErrors;
};

var oldAdd = DetectiveList.prototype.add;
DetectiveList.prototype.add = function(filepath) {
  // since the core find logic does not deal with directories, make sure the core add
  // is called only with files, even if the input was a set of directories
  var self = this;
  if (Array.isArray(filepath)) {
    filepath.forEach(function(filepath) {
      self.add(filepath);
    });
    return this;
  }

  var stat = fs.statSync(filepath);
  if (stat.isDirectory()) {
    var basepath = filepath + (filepath[filepath.length - 1] !== path.sep ? path.sep : '');
    return this.add(fs.readdirSync(basepath).map(function(f) {
      return basepath + f;
    }));
  } else {
    return oldAdd.apply(this, Array.prototype.slice.apply(arguments));
  }
};

var oldExec = DetectiveList.prototype.exec;
DetectiveList.prototype.exec = function() {
  this._resolveErrors = [];
  return oldExec.apply(this, Array.prototype.slice.apply(arguments));
};

module.exports = DetectiveList;
