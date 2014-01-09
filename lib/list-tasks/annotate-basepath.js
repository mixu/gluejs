// This task calculates the longest common substring among the file paths

function check(obj) {
  return (obj.name.charAt(index) == first.name.charAt(index));
}

module.exports = function(list) {
  var index = 0,
      first = list.files[0];

  if(!first) return;

  while(list.files.every(check) && index < first.name.length) {
    index++;
  }

  list.basepath = first.name.substr(0, index);
};
