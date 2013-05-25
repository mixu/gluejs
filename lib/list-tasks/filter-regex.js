// Filter out files from a list by a blacklist of regular expressions
module.exports = function(list, expressions) {
  list.files = list.files.filter(function(obj, i) {
    var name = obj.name;
    return !expressions.some(function(expr) {
      return name.match(expr);
    });
  });
};
