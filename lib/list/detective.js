var fs = require('fs'),
    path = require('path'),
    detective = require('detective'),
    resolve = require('browser-resolve'),
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

  var key = opts['cache-hash'] + '-dependencies',
      noCache = false; // for easy dev

  // replace the find function to use node-detective
  this.find(function(filepath, stat, onDone) {
    var self = this;
    // only .js files
    if(path.extname(filepath) != '.js') {
      return onDone(null, []);
    }

    var deps;

    log.info('Parsing:', filepath);

    // check the cache
    deps = cache.file(filepath).data(key);
    if (noCache || typeof deps === 'undefined') {
      try {
        deps = detective(fs.readFileSync(filepath).toString());
      } catch(e) {
        console.log('parse error: ', filepath, e);
        cache.file(filepath).data(key, []);
        return [];
      }
      // store result
      cache.file(filepath).data(key, deps);
    } else {
      // console.log('using cached result', filepath, deps);
    }

    // console.log(deps);

    if(!deps || deps.length === 0) {
      return onDone(null, []);
    }

    var queue = [],
        expected = deps.length,
        complete = 0;

    // return deps.filter(function(dep) {
    //     return !resolve.isCore(dep);
    //   }).map(function(dep) {

    deps.forEach(function(dep) {
      resolve(dep, { filename: filepath }, function(err, normalized) {
        complete++;
        if(err) {
          // console.log('resolve error: ', err, dep, filepath);
          self._resolveErrors.push({ err: err, dep: dep, filepath: filepath });
          return;
        }

        // console.log('RESOLVE', normalized);

        queue.push(path.normalize(normalized));
        if(complete == expected) {
          return onDone(null, queue);
        }
      });
    });
  });
}

DetectiveList.prototype = new List();

DetectiveList.prototype.resolveErrors = function() {
 return this._resolveErrors;
};

var oldExec = DetectiveList.prototype.exec;
DetectiveList.prototype.exec = function() {
  this._resolveErrors = [];
  oldExec.apply(this, Array.prototype.slice.apply(arguments));
};

module.exports = DetectiveList;
