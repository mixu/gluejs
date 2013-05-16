module.exports = function(tree) {
  tree.files = tree.files.filter(function(obj, i) {
    var name = obj.name;
    return !(name.match(/^\/test\/.*/) || name.match(/^\/dist\/.*/)  || name.match(/test\.js$/));
  });
};
