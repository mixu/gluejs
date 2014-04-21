var path = require('path'),
    jade = require('jade');

module.exports = function(filename) {
  // gluejs modules can be skipped by returning false
  if(path.extname(filename) != '.jade') {
    return;
  }

  // Minitask "sync" function
  return function(input) {
    return 'var jade = require(\'jade\').runtime;\n' +
            'module.exports = ' + jade.compile(input, { filename: filename }).toString() + ';';
  };
};

// indicate that this is a gluejs module rather than a browserify module
// this is needed because gluejs/Minitask features are a superset of browserify's features
// see get-commands.js in gluejs for the details
module.exports.gluejs = true;
