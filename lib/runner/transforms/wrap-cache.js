module.exports = function(cache, cacheHash) {
  return {
    // cache keys need to be generated based on the config hash to become a factor
    // in the invalidation in addition to the file content
    key: function(name) {
      return cacheHash + '-' + name;
    },
    get: function(filename, key, isPath) {
      if (isPath) {
        return cache.file(filename).path(this.key(key));
      } else {
        return cache.file(filename).data(this.key(key));
      }
    },
    set: function(filename, key, value, isPath) {
      if (isPath) {
        return cache.file(filename).path(this.key(key), value);
      } else {
        return cache.file(filename).data(this.key(key), value);
      }
    },
    filepath: function() {
      return cache.filepath();
    }
  };
};
