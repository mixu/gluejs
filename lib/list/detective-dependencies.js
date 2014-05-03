var fs = require('fs'),
    path = require('path'),
    detective = require('mine'),
    resolve = require('browser-resolve'),
    nodeResolve = require('resolve'),
    parallel = require('miniq'),
    log = require('minilog')('detective-deps');

module.exports = function(filepath, contentPath, ignoreDeps, cacheHash, onDone) {
  // outputs:
  var rawDeps,
      resolvedDeps = [],
      renames = [];

  // any non-json files
  if (path.extname(filepath) === '.json') {
    return onDone(null, [], resolvedDeps, renames);
  }

  // log.debug('Parsing:', filepath, contentPath);
  var start = new Date().getTime();
  fs.readFile(contentPath, function(err, data) {
    try {
      rawDeps = detective(data.toString()).map(function (d) { return d.name });
    } catch (e) {
      // augment with the path property
      if (e.lineNumber) {
        e.path = filepath;
      }
      log.error('Parse error: ', contentPath, e);
      return onDone(e, [], resolvedDeps, renames);
    }

    if (!rawDeps || rawDeps.length === 0) {
      log.debug('Result:', filepath, []);
      return onDone(null, [], resolvedDeps, renames);
    }

    if (ignoreDeps) {
      var normalizedNames = rawDeps.map(function(name) {
        // absolute deps can be of the ugly form "foo/bar.js",
        // which should be interpreted as "foo"
        return name.split('/')[0];
      });
      rawDeps = rawDeps.filter(function(unused, index) {
        return (ignoreDeps.indexOf(normalizedNames[index]) === -1);
      });
    }

    var errors = [];
    parallel(12, rawDeps.map(function(dep) {
      return function(done) {
        var basedir = path.dirname(filepath);

        if(!cacheHash[basedir]) {
          cacheHash[basedir] = {};
        }
        if (cacheHash[basedir][dep]) {
          var item = cacheHash[basedir][dep]
          if (item.canonical && item.normalized) {
            renames.push(item.canonical, item.normalized);
          }
          resolvedDeps.push(item.resolvedDeps);
          return done();
        }

        resolve(dep, { filename: filepath }, function(err, normalized) {
        // nodeResolve(dep, { basedir: path.dirname(filepath) }, function(err, normalized) {

          if (err) {
            log.error('Resolve error:', err, dep, filepath, resolvedDeps);
            errors.push({ err: err, dep: dep, filepath: filepath });
            return done();
          }
          // browser-resolve may replace specific files with different names
          var canonical = nodeResolve.sync(dep, { basedir: basedir });

          cacheHash[basedir][dep] = {};
          if (canonical != normalized) {
            renames.push(canonical, normalized);
            cacheHash[basedir][dep].renames = [ canonical, normalized];
          }
          cacheHash[basedir][dep].resolvedDeps = path.normalize(normalized);
          resolvedDeps.push(path.normalize(normalized));
          done();
        });
      };
    }), function() {
      log.debug('Result:', filepath, resolvedDeps);
      return onDone(errors.length > 0 ? errors : null, rawDeps, resolvedDeps, renames);
    });
  });
};
