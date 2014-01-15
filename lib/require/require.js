/*
  This immediately invoked function expression is needed to prevent chained
  require functions from sharing the same previousRequire.

  It returns a require() function in the root context.
*/
(function() {
  var previousRequire = typeof require == "function" && require;

  /* Require the given `path`; returns {Object} exports; */
  var r = function(path, context, parent) {

    if(!context) {
      context = 0;
    }
    /* Resolve `path` to a lookup entry. */
    var mod = r.m[context][path + '.js'] ||
              r.m[context][path + '/index.js'] ||
              r.m[context][path];

    if (!mod && previousRequire) {
      mod = previousRequire(path);
      if(mod) {
        return mod;
      }
    }
    if(mod && mod.c) {
      /* submodule - load the actual module */
      context = mod.c;
      mod = r.m[context][mod.m];
      /* error reporting: mod.main = path and parent = mod.c */
      path = mod.m;
      parent = context;
    }
    if(!mod) {
      throw new Error('failed to require "' + path + '" from ' + parent);
    }
    if (!mod.exports) {
      mod.exports = {};
      mod.call(mod.exports, mod, mod.exports, r.relative(path, context));
    }
    return mod.exports;
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
