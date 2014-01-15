function umd(f, name) {
  // CommonJS
  if (typeof exports === "object") {
    module.exports = f;
  // RequireJS
  } else if (typeof define === "function" && define.amd) {
    define(f);
  // <script>
  } else {
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
}
