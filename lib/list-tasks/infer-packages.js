var fs = require('fs'),
    path = require('path'),
    annotateStructured = require('./annotate-structured.js');

// assigns unique ids to packages to disabiguate between packages with the same name
// without referring to packages directly by their index in the structure
var uid = 0;

// Applies multiple annotations
//
// Takes `list.files` as the input and generates `list.packages`

module.exports = function(list, options) {
  uid = 0;
  if(!options) {
    options = {};
  }
  // regroup the files by splitting each name on the directory separator
  annotateStructured(list);
  var structured = list.structured;

  function exists(arr, path) {
    // console.log('exists', path);
    if(typeof path == 'string') {
      return arr.some(function(item) { return item.name == path; });
    } else if(path instanceof RegExp) {
      return arr.some(function(item) { return path.test(item.name); });
    }
  }

  function getMainFile(basepath, currentDirFiles) {
    var mainFile,
        packageJsonPath = path.normalize(basepath+'/package.json');
    // use existsSync; for example, underscore has a .gitignore
    // that filters out the package.json file; we need to treat it as existing
    // even if it is excluded

    if(fs.existsSync(packageJsonPath)) {
      // 1. package.json
      var data = JSON.parse(fs.readFileSync(packageJsonPath));

      // Note: lookups from list.files are intentional: need to look at all the available
      // paths, rather than just the ones in the current directory.

      if(data.main) {
        var guess = path.resolve(basepath, data.main);
        if(exists(list.files, guess)) {
          mainFile = path.normalize(data.main);
        } else if(exists(list.files, guess + '.js')) {
          mainFile = path.normalize(data.main + '.js');
        } else if(exists(list.files, guess + '.json')) {
          mainFile = path.normalize(data.main + '.json');
        } else if(exists(list.files, guess + '/index.js')) {
          mainFile = path.normalize(data.main + '/index.js');
        }
      }
    }
    if(!mainFile && currentDirFiles && exists(currentDirFiles, /\/index.js$/)) {
      // 2. index.js
      mainFile = 'index.js';
    }
    // remove ./ prefix for main files, since the require() implementation does not run
    // path processing when switching between contexts
    if(mainFile && mainFile.substr(0, 2) == './') {
      mainFile = mainFile.substr(2);
    }

    // 3. index.node (unsupported - binary addition)
    return mainFile;
  }

  // console.log(structured);

  var packages = [ { files: [], dependenciesById: {} } ];

  // we cannot auto-detect the basepath (since the base package might consist of multiple
  // different directories) but we can read it in
  if(options.basepath) {
    packages[0].basepath = options.basepath;
  }

  function getPackage(root, currentPath, packageIndex) {
    // handle files
     if(root['.']) {
        root['.'].forEach(function(file) {
          // the relname was relative to the current path - it will be misleading for a package
          delete file.relname;
          // packages[packageIndex].files.push( relPath + file.name );
          packages[packageIndex].files.push( file );
        });
     }

    Object.keys(root).forEach(function(dirname) {
      var packageName, packageBase, index,
          mainFile;
      if(dirname != 'node_modules' && dirname != '.') {
        getPackage(root[dirname], currentPath + dirname + '/', packageIndex);
      } else if(dirname == 'node_modules') {
        // single file packages
        if(root['node_modules']['.']) {
          root['node_modules']['.'].forEach(function(file) {
            // add single-file package
            mainFile = path.basename(file.name);
            packageName = mainFile.replace(/(\.js|\.json)$/, '');
            packageBase = path.dirname(file.name) + '/';
            index = packages.length;

            // the relname was relative to the current path - it will be misleading for a package
            delete file.relname;

            packages[index] = {
              name: packageName,
              uid: ++uid,
              basepath: packageBase,
              main: mainFile,
              files: [ file ],
              dependenciesById: {}
            };
            // add parent dependency
            packages[packageIndex].dependenciesById[packageName] = packages[index].uid;
          });
        }
        // handle modules
        Object.keys(root['node_modules']).forEach(function(dirname) {
          if(dirname != '.') {
            // create a new package
            index = packages.length;
            packageName = dirname;
            packageBase = currentPath + 'node_modules/'+ dirname +'/';
            var files = root['node_modules'][dirname]['.'];

            // detect the main file
            mainFile = getMainFile(packageBase, files);

            packages[index] = {
              name: packageName,
              uid: ++uid,
              basepath: packageBase,
              main: mainFile,
              files: [],
              dependenciesById: {}
            };
            // add parent dependency
            packages[packageIndex].dependenciesById[packageName] = packages[index].uid;
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
  if(options.main) {
    packages[0].main = options.main;
  }
  // after completing the packagification
  // detect the main file for the root package (but only if it has a basepath)
  if(packages[0].basepath && !packages[0].main) {
    packages[0].main = getMainFile(packages[0].basepath, packages[0].files);
  }

  // var util = require('util');
  // console.log(util.inspect(list.packages, null, 5, true),
  //             util.inspect(packages, null, 5, true));

  list.packages = packages;
};

// to override the fs module, which is only used for reading in package.json files
module.exports._setFS = function(newFs) {
  fs = newFs;
};
