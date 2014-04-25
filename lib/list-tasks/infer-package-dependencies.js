var fs = require('fs'),
    path = require('path');

function uniq() {
  var prev;
  return function(i) {
    var isDup = (i == prev);
    prev = i;
    return !isDup;
  };
}

module.exports = function(list, opts) {
  function getPackageDependencies(basepath) {
    var dependencies;
    var packageJsonPath = path.normalize(basepath + '/package.json');
    if (fs.existsSync(packageJsonPath)) {
      // 1. package.json
      var data = JSON.parse(fs.readFileSync(packageJsonPath));
      if (data.dependencies) {
        dependencies = Object.keys(data.dependencies);
      }
    }
    if (!dependencies) {
      dependencies = [];
    }

    return dependencies;
  }

  function lookupPackageId(prev, key) {
    var index = null;
    list.packages.some(function(item, i) {
      var isMatch = item.name == key;
      if (isMatch) {
        index = i;
      }
      return isMatch;
    });

    prev[key] = index;
    return prev;
  }

  // console.log(require('util').inspect(list.packages, null, 20, true));

  list.packages.forEach(function(pkg) {
    if (!pkg.basepath) {
      pkg.dependenciesById = {};
      return;
    }
    var deps = getPackageDependencies(pkg.basepath),
        basepathParts = pkg.basepath.split(path.sep).filter(Boolean);

    // what are potential dependencies?
    // - for a module:
    //   - any packages with paths inside the current module, and with at most one node_modules folder
    //   - any packages above the current module
    // - for the root package:
    //   - any packages with paths inside the current module, and with at most one node_modules folder
    //   - any packages above the current module

    // find all packages which are one level above this, and add them as dependencies
    deps = deps.concat(list.packages.map(function(item) {
      if (!item.basepath || item === pkg) {
        return false;
      }
      var parts = item.basepath.split(path.sep).filter(Boolean),
          i;

      // e.g. .../node_modules/jquery/ .../node_modules/jade/
      // cannot be dependent because they are peers
      if (path.dirname(pkg.basepath) == path.dirname(item.basepath)) {
        return false;
      }

      var partsUntilFirstModules = [];

      for (i = 0; i < parts.length; i++) {
        if (parts[i] == 'node_modules') {
          break;
        }
        partsUntilFirstModules.push(parts[i]);
      }

      if (partsUntilFirstModules.length < basepathParts.length) {
        // may be a parent directory of the current module
        for (i = 0; i < partsUntilFirstModules.length; i++) {
          if (partsUntilFirstModules[i] != basepathParts[i]) {
            //console.log(pkg.basepath, item.basepath, 'below', partsUntilFirstModules[i], basepathParts[i], i);
            return false;
          }
        }
        return item.name;
      }

      // must be a subdirectory of the current module
      for (i = 0; i < basepathParts.length; i++) {
        if (parts[i] != basepathParts[i]) {
          // console.log(pkg.basepath, item.basepath, 'fail1', parts[i], basepathParts[i], i);
          return false;
        }
      }
      // must be in a */node_modules directory under the current module
      // must not be in */node_modules/**/node_modules/
      // e.g. must have exactly one node_modules component in the rest of the path
      var nodeModulePartCount = 0;
      for (; i < parts.length; i++) {
        if (parts[i] == 'node_modules') {
          nodeModulePartCount++;
        }
      }
      // console.log(pkg.basepath, item.basepath, 'nodeModulePartCount',
      // parts.join('/').substr(basepathParts.join('/').length), nodeModulePartCount);

      var isMatch = (nodeModulePartCount === 1);
      return (isMatch ? item.name : false);
    }).filter(Boolean)).sort().filter(uniq());

    // console.log(pkg.basepath, deps);
    // from [ "foo", "bar" ] to { "foo": 1, ... }
    pkg.dependenciesById = (deps.length === 0 ? {} : deps.reduce(lookupPackageId, { }));

  });

};
