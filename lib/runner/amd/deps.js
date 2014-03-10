var fs = require('fs'),
    amdetective = require('amdetective');

var key = 'amdependencies';

module.exports = function(cache, filepath, onErr) {
  // check the cache
  deps = cache.file(filepath).data(key);
  if (typeof deps === 'undefined') {
    try {
      deps = amdetective(fs.readFileSync(filepath).toString());
    } catch(e) {
      cache.file(filepath).data(key, []);
      if(onErr) {
        onErr(e);
      }
      return [];
    }
    cache.file(filepath).data(key, deps);
  }
  return deps;
};
