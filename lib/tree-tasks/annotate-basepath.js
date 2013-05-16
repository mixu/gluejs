module.exports = function(tree) {
  var index = 0,
      first = tree.files[0];

  if(!first) return;

  while(tree.files.every(function(obj) {
    return (obj.name.charAt(index) == first.name.charAt(index));
  }) && index < first.name.length) {
    index++;
  }

  tree.basepath = first.name.substr(0, index);
};
