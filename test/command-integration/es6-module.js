var path = require('path'),
    Compiler = require("es6-module-transpiler").Compiler;

module.exports = function(filename) {
  // gluejs modules can be skipped by returning false
  if(path.extname(filename) != '.js') {
    return;
  }

  // Minitask "sync" function
  return function(input) {
    var compiler = new Compiler(input, path.basename(filename, '.js'));
    return compiler.toCJS();
  };
};

// indicate that this is a gluejs module rather than a browserify module
// this is needed because gluejs/Minitask features are a superset of browserify's features
// see get-commands.js in gluejs for the details
module.exports.gluejs = true;
