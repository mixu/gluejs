module.exports = function(prefix, opts, spec) {
  var requiredOpts = Object.keys(spec.required),
      optionalOpts = Object.keys(spec.optional);

  if (!opts) {
    throw new Error(prefix + ': opts is required!');
  } else {
    requiredOpts.forEach(function(key) {
      if (!opts[key]) {
        throw new Error(prefix + ': opts.' + key + ' is required!');
      }
    });

    Object.keys(opts).forEach(function(key) {
      if (requiredOpts.indexOf(key) === -1 && optionalOpts.indexOf(key) === -1) {
        throw new Error(prefix + ': unknown option: ' + key);
      }
    });
  }
};
