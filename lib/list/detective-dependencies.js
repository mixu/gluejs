var fs = require('fs'),
    path = require('path'),
    detective = require('detective'),
    resolve = require('browser-resolve'),
    nodeResolve = require('resolve'),
    parallel = require('miniq'),
    log = require('minilog')('detective-deps');

module.exports = function(filepath, onDone) {
  // only .js files
  if(path.extname(filepath) != '.js') {
    return onDone(null, []);
  }

  // outputs:
  var rawDeps,
      resolvedDeps = [],
      renames = [];

  // log.debug('Parsing:', filepath);
  try {
    rawDeps = detective(fs.readFileSync(filepath).toString());
  } catch(e) {
    log.error('Parse error: ', filepath, e);
    return onDone(e, [], resolvedDeps, renames);
  }

  if(!rawDeps || rawDeps.length === 0) {
    log.debug('Result:', filepath, []);
    return onDone(null, [], resolvedDeps, renames);
  }

  var errors = [];
  parallel(1, rawDeps.map(function(dep) {
    return function(done) {
      resolve(dep, { filename: filepath }, function(err, normalized) {
        if (err) {
          log.error('Resolve error:', err, dep, filepath, resolvedDeps);
          errors.push({ err: err, dep: dep, filepath: filepath });
          return done();
        }
        // browser-resolve may replace specific files with different names
        var canonical = nodeResolve.sync(dep, { basedir: path.dirname(filepath) });
        if (canonical != normalized) {
          renames.push(canonical, normalized);
        }
        resolvedDeps.push(path.normalize(normalized));
        done();
      });
    };
  }), function() {
    log.debug('Result:', filepath, resolvedDeps);
    return onDone(errors.length > 0 ? errors : null, rawDeps, resolvedDeps, renames);
  });
};
