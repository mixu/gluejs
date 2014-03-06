var fs = require('fs'),
    template = fs.readFileSync(__dirname + '/../util/amd-vendor-wrap.js').toString();

module.exports = function wrapAMDVendor(name, filepath, deps, globalName) {
  var result = '';

  if(!filepath) {
    return '';
  }

  if(globalName) {
    result += fs.readFileSync(filepath).toString();
    result += template.replace('%name%', JSON.stringify(name)).replace('%deps%', JSON.stringify(deps)).replace('%global%', globalName);
  } else {
    // assuming: define(function (require, exports, module) {
    // -> define('decode',['require','exports','module'],function (require, exports, module) {
    result += fs.readFileSync(filepath).toString().replace('define(', 'define(' +
      JSON.stringify(name) + ', ' +
      JSON.stringify(deps || ['require','exports','module']) + ', '
    );
  }

  return result;
}
