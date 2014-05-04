// need to run some callbacks just once, avoid littering the code with tiny booleans
module.exports = function runOnce(fn) {
  var ran = false;
  return function() {
    if (!ran) {
      fn.apply(fn, Array.prototype.slice(arguments));
    }
  };
};
