var fs = require('fs'),
    path = require('path'),
    amdresolve = require('amd-resolve'),
    amdDeps = require('../runner/amd/deps.js'),
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

  // replace the find function to use node-detective
  this.find(function(filepath, stat, onDone) {
    var self = this;
    // only .js files
    if(path.extname(filepath) != '.js') {
      return onDone(null, []);
    }

    // log.info('Parsing:', filepath);

    var deps = amdDeps(cache, filepath, function(err) {
      console.log('parse error: ', filepath, err);
    });

    // console.log(deps);

    if(!deps || deps.length === 0) {
      return onDone(null, []);
    }

    var queue = [],
        expected = deps.length,
        complete = 0;

    deps.filter(function(dep) {
        return !amdresolve.isSpecial(dep);
    }).forEach(function(dep) {
      var normalized,
          currOpts = opts.amdresolve || {};

      // override relDir for each file
      currOpts.relDir = path.dirname(filepath);

      try {
        normalized = amdresolve.sync(dep, currOpts);
      } catch(err) {
        // console.log('resolve error: ', err, dep, filepath);
        self._resolveErrors.push({ err: err, dep: dep, filepath: filepath });
        return;
      }
      // console.log('RESOLVE', dep, normalized);

      queue.push(path.normalize(normalized));
    });

    return onDone(null, queue);
  });
}

DetectiveList.prototype = new List();

DetectiveList.prototype.resolveErrors = function() {
 return this._resolveErrors;
};

var oldExec = DetectiveList.prototype.exec;
DetectiveList.prototype.exec = function() {
  this._resolveErrors = [];
  return oldExec.apply(this, Array.prototype.slice.apply(arguments));
};

module.exports = DetectiveList;
