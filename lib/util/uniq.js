module.exports = function() {
  var prev = null;
  return function(item) {
    var isDuplicate = (item == prev);
    prev = item;
    return !isDuplicate;
  };
};
