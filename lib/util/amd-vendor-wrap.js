}(function(a,b,c) {
  var args = arguments;
  return define(args.length == 3 ? a : %name%, (b && b instanceof Array ? b : %deps%), args[args.length - 1]);
}));
