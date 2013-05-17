var fs = require('fs');

// This task adds a .stat property to every file in the tree
module.exports = function(tree) {
  tree.files.forEach(function(obj, i) {
    tree.files[i].stat = fs.statSync(obj.name);
  });
};
