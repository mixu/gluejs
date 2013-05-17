var fs = require('fs'),
    path = require('path'),
    annotateStructured = require('./annotate-structured.js');

// Applies multiple annotations
//
// Takes `tree.files` as the input and generates `tree.packages`

module.exports = function(tree) {
  // regroup the files by splitting each name on the directory separator
  annotateStructured(tree);
  var structured = tree.structured;

  function exists(path) {
    return tree.files.some(function(item) { return item.name == path; });
  }

  // console.log(structured);

  var packages = [ { files: [], dependencies: {} } ];

  function getPackage(root, currentPath, packageIndex) {
    var relPath = currentPath;
    // relative path is excludes the package basepath for the current package
    if(packages[packageIndex].basepath) {
      relPath = currentPath.substr(packages[packageIndex].basepath.length);
    }
    // handle files
     if(root['.']) {
        root['.'].forEach(function(filename) {
            packages[packageIndex].files.push( relPath + filename );
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
          root['node_modules']['.'].forEach(function(filename) {
            // add single-file package
            packageName = filename.replace(/(\.js|\.json)$/, ''),
            packageBase = currentPath + 'node_modules/';
            index = packages.length;
            mainFile = filename;

            packages[index] = {
              name: packageName,
              basepath: packageBase,
              mainfile: mainFile,
              files: [ filename ],
              dependencies: {}
            };
            // add parent dependency
            packages[packageIndex].dependencies[packageName] = index;
          });
        }
        // handle modules
        Object.keys(root['node_modules']).forEach(function(dirname) {
          if(dirname != '.') {
            // create a new package
            index = packages.length;
            packageName = dirname;
            packageBase = currentPath + 'node_modules/'+ dirname + '/';
            var files = root['node_modules'][dirname]['.'];

            // detect the main file
            if(files && files.indexOf('package.json') > -1) {
              // 1. package.json
              var data = JSON.parse(fs.readFileSync(packageBase+'package.json'));
              if(data.main) {
                var guess = path.resolve(packageBase, data.main);
                if(exists(guess)) {
                  mainFile = data.main;
                } else if(exists(guess + '.js')) {
                  mainFile = data.main + '.js';
                } else if(exists(guess + '.json')) {
                  mainFile = data.main + '.json';
                } else if(exists(guess + '/index.js')) {
                  mainFile = path.normalize(data.main + '/index.js');
                }
              }
            }
            if(!mainFile && files && files.indexOf('index.js') > -1) {
              // 2. index.js
              mainFile = 'index.js';
            }

            // 3. index.node (unsupported - binary addition)

            packages[index] = {
              name: packageName,
              basepath: packageBase,
              mainfile: mainFile,
              files: [],
              dependencies: {}
            };
            // add parent dependency
            packages[packageIndex].dependencies[packageName] = index;
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

  tree.packages = packages;
};

// to override the fs module, which is only used for reading in package.json files
module.exports._setFS = function(newFs) {
  fs = newFs;
}
