// Filter out files from a tree by a blacklist of regular expressions
module.exports = function(tree, expressions) {
  tree.files = tree.files.filter(function(obj, i) {
    var name = obj.name;
    return !expressions.some(function(expr) {
      return name.match(expr);
    });
  });
};
