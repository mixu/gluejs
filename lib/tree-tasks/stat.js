var fs = require('fs');

module.exports = function(tree) {
  tree.files.forEach(function(obj, i) {
    tree.files[i].stat = fs.statSync(obj.name);
  });
};
