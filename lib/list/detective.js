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
      renameKey = opts['cache-hash'] + '-dependencies-rename',
      noCache = false; // for easy dev

  log.debug('Cache:', opts['cache-method'], opts['cache-path'], opts['cache-hash']);

  // replace the find function to use node-detective
  this.find(function(filepath, stat, onDone) {
    var self = this;
    // only .js files
    if(path.extname(filepath) != '.js') {
      return onDone(null, []);
    }
    // cache the whole operation!
    var result = cache.file(filepath).data(resultKey);

    if (!noCache && Array.isArray(result)) {
      var renames = cache.file(filepath).data(renameKey);
      if(renames && Array.isArray(renames)) {
        self.onRename(renames[0], renames[1]);
      }
      log.debug('Using cached result:', filepath, result);
      return onDone(null, result);
    } else {
      // log.debug('Nothing in cache for:', filepath, resultKey);
    }

    var deps;

    // check the cache
    deps = cache.file(filepath).data(depKey);
    if (noCache || typeof deps === 'undefined') {
      // log.debug('Parsing:', filepath);
      try {
        deps = detective(fs.readFileSync(filepath).toString());
      } catch(e) {
        log.error('Parse error: ', filepath, e);
        cache.file(filepath).data(depKey, []);
        return [];
      }
      // store result
      cache.file(filepath).data(depKey, deps);
    } else {
      log.debug('Using cached deps:', filepath, deps);
    }

    // console.log(deps);

    if(!deps || deps.length === 0) {
      // store result
      cache.file(filepath).data(resultKey, []);
      log.debug('Result:', filepath, []);
      return onDone(null, []);
    }

    var expected = deps.length,
        complete = 0,
        hasErrors = false;

    result = [];

    // return deps.filter(function(dep) {
    //     return !resolve.isCore(dep);
    //   }).map(function(dep) {

    deps.forEach(function(dep) {
      resolve(dep, { filename: filepath }, function(err, normalized) {
        complete++;
        if (err) {
          hasErrors = true;
          log.error('Resolve error:', err, dep, filepath, result);
          self._resolveErrors.push({ err: err, dep: dep, filepath: filepath });
          // do not store result when an error occurs
          if(complete == expected) {
            return onDone(null, result);
          }
          return;
        }

        // browser-resolve may replace specific files with different names
        if (self.onRename) {
          var canonical = nodeResolve.sync(dep, { basedir: path.dirname(filepath) });
          if(canonical != normalized) {
            self.onRename(canonical, normalized);
            // do not store result when an error occurs
            if(!hasErrors) {
              cache.file(filepath).data(renameKey, [ canonical, normalized ]);
            }
          }
        }

        result.push(path.normalize(normalized));
        if(complete == expected) {
          // do not store result when an error occurs
          if(!hasErrors) {
            cache.file(filepath).data(resultKey, result);
          } else {
            log.debug('Skipping cache due to errors:', filepath);
          }

          log.debug('Result:', filepath, result);
          return onDone(null, result);
        }
      });
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
    this.add(fs.readdirSync(basepath).map(function(f) {
      return basepath + f;
    }));
  } else {
    oldAdd.apply(this, Array.prototype.slice.apply(arguments));
  }
};

var oldExec = DetectiveList.prototype.exec;
DetectiveList.prototype.exec = function() {
  this._resolveErrors = [];
  oldExec.apply(this, Array.prototype.slice.apply(arguments));
};

module.exports = DetectiveList;
