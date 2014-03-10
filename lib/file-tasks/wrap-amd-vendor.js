var fs = require('fs'),
    template = fs.readFileSync(__dirname + '/../util/amd-vendor-wrap-global.js').toString(),
    template2 = fs.readFileSync(__dirname + '/../util/amd-vendor-wrap.js').toString();

module.exports = function wrapAMDVendor(name, content, deps, globalName) {
  var result = '';

  // globalName is defined for modules which are "shimmed" e.g. they export a global which
  // is then wrapped as AMD
  if(globalName) {
    result += content;
    // newline here is necessary since files may not end with a newline and may end with a comment
    result += '\n' + template.replace('%name%', JSON.stringify(name))
                             .replace('%deps%', JSON.stringify(deps))
                             .replace('%global%', globalName);
  } else {
    // the r.js optimizer does a bunch of source transformations which are
    // basically impossible to extract without importing the whole damn thing
    // however, since the end result of those transformations is just to map to a specific form
    // of define() call, we can just wrap the module and deal with the four (!) or so variants
    // of define calls that r.js allows.
    result += '\n' + '(function(define) {\ndefine.amd = {};\n';
    result += content;
    result += template2.replace(/%name%/g, JSON.stringify(name))
                             .replace(/%deps%/g, JSON.stringify(deps));
  }
  return result;
};
