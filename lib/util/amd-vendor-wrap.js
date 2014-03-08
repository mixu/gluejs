}(function(a,b,c) {
  var args = arguments, hasName = args.length == 3;
  return define(hasName ? a : %name%, (hasName && a != %name% ? b : %deps%), args[args.length - 1]);
}));
