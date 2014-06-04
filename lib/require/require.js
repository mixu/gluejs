/*
  This immediately invoked function expression is needed to prevent chained
  require functions from sharing the same previousRequire.

  It returns a require() function in the root context.
*/
var r = (function() {
  var previousRequire = typeof require == "function" && require;

  /* Require the given `path`; returns {Object} exports; */
  var r = function(p, context, parent) {

    if(!context) {
      context = 0;
    }
    /* Note: cannot inline here as resolve both resolves and sets the path var;
       in normal usage path is passed on to require.relative.
    */
    var path = r.resolve(p, context),
        mod = r.m[context][path];
    // if the module is not loaded and there is a top level require, try using it
    if (!mod && previousRequire) {
      mod = previousRequire(path);
      if (mod) {
        return mod;
      }
    } else if (mod && mod.c) {
      // the module was found, but it is a submodule, load the actual module
      context = mod.c;
      path = mod.m;
      mod = r.m[context][mod.m];
      if(!mod) {
        throw new Error('failed to require "' + path + '" from ' + context);
      }
    }
    if (!mod) {
      // the initial load failed, or the previous require failed
      throw new Error('failed to require "' + p + '" from ' + parent);
    }
    if (!mod.exports) {
      mod.exports = {};
      mod.call(mod.exports, mod, mod.exports, r.relative(path, context));
    }
    return mod.exports;
  };

  r.resolve = function(path, context){
    var orig = path,
        reg = path + '.js',
        index = path + '/index.js';
    if(r.m[context][reg] && reg) {
      return reg;
    } else if(r.m[context][index] && index) {
      return index;
    }
    return orig;
  };

  /* Return a require function relative to the `relativeTo` path.
   * Note that this is needed to export a global require function.
   */

  r.relative = function(relativeTo, context) {
    return function(p){
      if ('.' != p.charAt(0)) {
        return r(p, context, relativeTo);
      }
      var path = relativeTo.split('/'), segs = p.split('/');
      path.pop();

      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if ('..' == seg) path.pop();
        else if ('.' != seg) path.push(seg);
      }

      return r(path.join('/'), context, relativeTo);
    };
  };
  return r;
}());
