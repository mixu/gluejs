var fs = require('fs'),
    path = require('path'),
    annotateStructured = require('./annotate-structured.js');

// assigns unique ids to packages to disabiguate between packages with the same name
// without referring to packages directly by their index in the structure
var uid = 0;

// Applies multiple annotations
//
// Takes `files` as the input and generates `packages`.
// `files`:
// [ {
//  filename: path-to-original-name,
//  content: path-to-content
// } ]


module.exports = function(files, options) {
  uid = 0;
  if (!options) {
    options = {};
  }
  // regroup the files by splitting each name on the directory separator
  var structured = annotateStructured(files);

  function exists(arr, path) {
    // console.log('exists', path);
    if (typeof path == 'string') {
      return arr.some(function(item) { return item.filename == path; });
    } else if (path instanceof RegExp) {
      return arr.some(function(item) { return path.test(item.filename); });
    }
  }

  function getMainFile(basepath, currentPackageFiles) {
    var mainFile,
        packageJsonPath = path.normalize(basepath + '/package.json');

    // console.log('getMainFile', basepath, currentPackageFiles);

    // use existsSync; for example, underscore has a .gitignore
    // that filters out the package.json file; we need to treat it as existing
    // even if it is excluded

    if (fs.existsSync(packageJsonPath)) {
      // 1. package.json
      var data = JSON.parse(fs.readFileSync(packageJsonPath));

      // Note: lookups from files are intentional: need to look at all the available
      // paths, rather than just the ones in the current directory.

      if (data.main) {
        var guess = path.resolve(basepath, data.main);
        if (exists(files, guess)) {
          mainFile = path.normalize(data.main);
        } else if (exists(files, guess + '.js')) {
          mainFile = path.normalize(data.main + '.js');
        } else if (exists(files, guess + '.json')) {
          mainFile = path.normalize(data.main + '.json');
        } else if (exists(files, guess + '/index.js')) {
          mainFile = path.normalize(data.main + '/index.js');
        }
      }
    }
    if (!mainFile && currentPackageFiles && exists(currentPackageFiles,
        path.resolve(basepath, './index.js'))) {
      // 2. index.js
      mainFile = 'index.js';
    }
    // 3. index.node (unsupported - binary addition)

    // 4. heuristic: if there is only one file, then make it the main file
    // this can happen for example if the browser field is used to replace a module
    if (!mainFile && currentPackageFiles.length == 1) {
      mainFile = path.relative(basepath, currentPackageFiles[0].filename);
    }

    // remove ./ prefix for main files, since the require() implementation does not run
    // path processing when switching between contexts
    if (mainFile && mainFile.substr(0, 2) == './') {
      mainFile = mainFile.substr(2);
    }

    return mainFile;
  }

  // console.log(structured);

  var packages = [{
    files: []
  }];

  // we cannot auto-detect the basepath (since the base package might consist of multiple
  // different directories) but we can read it in
  if (options.basepath) {
    packages[0].basepath = options.basepath;
  }

  function getPackage(root, currentPath, packageIndex) {
    // handle files
     if (root['.']) {
        root['.'].forEach(function(file) {
          // the relname was relative to the current path - it will be misleading for a package
          delete file.relname;
          // packages[packageIndex].files.push( relPath + file.filename );
          packages[packageIndex].files.push(file);
        });
     }

    Object.keys(root).forEach(function(dirname) {
      var packageName, packageBase, index,
          mainFile;
      if (dirname != 'node_modules' && dirname != '.') {
        getPackage(root[dirname], currentPath + dirname + '/', packageIndex);
      } else if (dirname == 'node_modules') {
        // single file packages
        if (root['node_modules']['.']) {
          root['node_modules']['.'].forEach(function(file) {
            // add single-file package
//            mainFile = path.basename(file.filename);
            packageName = mainFile.replace(/(\.js|\.json)$/, '');
            packageBase = path.dirname(file.filename) + '/';
            index = packages.length;

            // the relname was relative to the current path - it will be misleading for a package
            delete file.relname;

            packages[index] = {
              name: packageName,
              uid: ++uid,
              basepath: packageBase,
              main: mainFile,
              files: [file]
            };
          });
        }
        // handle modules
        Object.keys(root['node_modules']).forEach(function(dirname) {
          if (dirname != '.') {
            // create a new package
            index = packages.length;
            packageName = dirname;
            packageBase = currentPath + 'node_modules/' + dirname + '/';
            var files = root['node_modules'][dirname]['.'];

            packages[index] = {
              name: packageName,
              uid: ++uid,
              basepath: packageBase,
              main: undefined,
              files: []
            };
            // traverse
            getPackage(root.node_modules[dirname], packageBase, index);
          }
        });
      }
    });
  }

  // the first package contains all files until we reach the first 'node_modules'
  // all other packages are delineated by a node_modules transition
  getPackage(structured, '/', 0);

  // set main path from options if given
  if (options.main) {
    packages[0].main = options.main;
  }
  // after completing the packagification
  // detect the main file for the root package (but only if it has a basepath)
  if (packages[0].basepath && !packages[0].main) {
    packages[0].main = getMainFile(packages[0].basepath, packages[0].files);
  }

  // first group files - then detect packages rather than trying to
  // do both at the same time and dealing with partial .files arrays
  packages.forEach(function(pkg, index) {
    if (!pkg.main) {
      // detect the main file
      pkg.main = getMainFile(pkg.basepath, pkg.files);
    }
  });

  // var util = require('util');
  // console.log(util.inspect(packages, null, 5, true));

  return packages;
};
