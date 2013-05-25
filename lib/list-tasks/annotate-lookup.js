// creates list.lookup, which is list.files but indexed by filename rather than an array
module.exports = function(list) {
  list.lookup = {};
  list.files.forEach(function(item) {
    list.lookup[item.name] = item;
  });
};
