var path = require('path');

// Applies multiple annotations
//
// Takes `tree.files` as the input and generates `tree.packages`

module.exports = function(tree) {
  var packages = {};
  // regroup the files by splitting each name on the directory separator

  tree.files.forEach(function(obj) {
    var pathParts = obj.name.split(path.sep).filter(function(item) { return item.length > 1; }),
        current = packages,
        i, part;

    for(i = 0; i < pathParts.length - 1; i++) {
      part = pathParts[i];
      if(!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // the last part is the file name - store under { ".": [ filename, filename ] }
    current['.'] = (current['.'] ? current['.'] : [] ).concat(pathParts[pathParts.length - 1 ]);

  });

  tree.packages = packages;
};
