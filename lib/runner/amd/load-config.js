var fs = require('fs'),
    vm = require('vm');

module.exports = function loadAMDConfig(filepath) {
  // the config specification for RJS is painful to parse as it's not a JSON file
  // but rather a JS file that defines as specifically named variable
  var sandbox = {};
  vm.runInNewContext(
    fs.readFileSync(filepath).toString(), sandbox);

  return sandbox.require;
}
