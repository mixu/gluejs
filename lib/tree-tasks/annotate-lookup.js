// creates tree.lookup, which is tree.files but indexed by filename rather than an array
module.exports = function(tree) {
  tree.lookup = {};
  tree.files.forEach(function(item) {
    tree.lookup[item.name] = item;
  });
};
