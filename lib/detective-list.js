var fs = require('fs'),
    path = require('path'),
    detective = require('detective'),
    resolve = require('browser-resolve'),
    List = require('minitask').list,
    Cache = require('minitask').Cache;

function DetectiveList(opts) {
  List.apply(this, Array.prototype.slice.call(arguments));

  var cache = Cache.instance({
      method: opts['cache-method'],
      path: opts['cache-path']
  });

  var key = opts['cache-hash'] + '-dependencies',
      noCache = false; // for easy dev

  // replace the find function to use node-detective
  this.find(function(filepath, stat, onDone) {
    // only .js files
    if(path.extname(filepath) != '.js') {
      return onDone(null, []);
    }

    var deps;

    // chech the cache
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
          console.log('resolve error: ', err, dep, filepath);
          return;
        }
        queue.push(path.normalize(normalized));
        if(complete == expected) {
          return onDone(null, queue);
        }
      });
    });
  });
};

DetectiveList.prototype = new List();

module.exports = DetectiveList;
