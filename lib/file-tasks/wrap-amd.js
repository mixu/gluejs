var fs = require('fs'),
    path = require('path');

module.exports = function wrapAMD(filepath, deps, basePath) {
  // the substr here will not be correct for files under folders which have been mapped unless the path length
  // happens to be identical e.g. app and lib
  var relativeName = (path.dirname(filepath) + '/' + path.basename(filepath, path.extname(filepath))).substr(basePath.length + 1);

  return fs.readFileSync(filepath).toString().replace('define(', 'define(' +
    JSON.stringify(relativeName) + ', ' +
    JSON.stringify(deps) + ', '
  );
};
