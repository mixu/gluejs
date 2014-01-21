function umd(f, name) {
  // CommonJS
  if (typeof exports === "object") {
    module.exports = f;
  }
  // RequireJS
  if (typeof define === "function" && define.amd) {
    // AMD tries to call functions which is a problem for node modules
    // which export a single function. So wrap the exports in a return statement.
    define(name, function() { return f; });
  }
  // The expected semantic for gluejs modules, even those built using
  // --umd, is to always export a global
  var g;
  if (typeof window !== "undefined") {
    g = window;
  } else if (typeof global !== "undefined") {
    g = global;
  } else if (typeof self !== "undefined") {
    g = self;
  }
  g[name] = f;
}
