/*!
 * Require functions by TJ Holowaychuk <tj@learnboost.com>
 * With enhancements by Mikito Takada for multi-package support.
 */

var previousRequire = typeof require == "function" && require;
/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

require = function(p, context, parent) {

  /**
   * Resolve `path`.
   *
   * @param {String} path
   * @return {Object} module
   * @api public
   */

  function resolve(path, context) {
    var reg = path + '.js',
        index = path + '/index.js';
    return require.m[context][reg] && reg ||
           require.m[context][index] && index ||
           path;
  };

  /**
   * Return a require function relative to the `relativeTo` path.
   *
   * @param {String} relativeTo
   * @return {Function}
   * @api private
   */

  function relative(relativeTo, context) {
    return function(p){
      if ('.' != p.charAt(0)) return require(p, context, relativeTo);

      var path = relativeTo.split('/'), segs = p.split('/');
      path.pop();

      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if ('..' == seg) path.pop();
        else if ('.' != seg) path.push(seg);
      }

      return require(path.join('/'), context, relativeTo);
    };
  };

  if(!context) {
    context = 0;
  }
  var path = resolve(p, context),
      mod = require.m[context][path];
  if (!mod && previousRequire) {
    mod = previousRequire(path);
    if(!mod) {
      throw new Error('failed to require "' + p + '" from ' + parent);
    } else {
      return mod;
    }
  }
  if(mod.c) {
    /* submodule - load the actual module */
    context = mod.c;
    path = mod.m;
    mod = require.m[context][mod.m];
    if (!mod) throw new Error('failed to require "' + path + '" from ' + context);
  }
  if (!mod.exports) {
    mod.exports = {};
    mod.call(mod.exports, mod, mod.exports, relative(path, context));
  }
  return mod.exports;
};

