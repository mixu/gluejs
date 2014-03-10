var fs = require('fs'),
    path = require('path');

module.exports = function wrapAMD(name, content, deps, basePath) {
  return content.toString().replace('define(', 'define(' +
    JSON.stringify(name) + ', ' +
    JSON.stringify(deps) + ', '
  );
};
