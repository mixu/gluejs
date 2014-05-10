var fs = require('fs'),
    path = require('path'),
    nodeResolve = require('resolve');

exports.inferBasepath = function(basepath, includes) {
  if (basepath) {
    return path.resolve(process.cwd(), basepath);
  }

  var first = (typeof includes === 'string' ? includes : includes[0]),
      firstStat;

  if (first.charAt(0) == '/') {
    // abs path to a file => use parent dir as basepath
    firstStat = (fs.existsSync(first) ? fs.statSync(first) : false);
    return (firstStat && firstStat.isFile() ? path.dirname(first) : first);
  }
  if (first.charAt(0) == '.') {
    // relative include => use process.cwd
    return process.cwd();
  }
  return;
};

exports.resolve = function(to, from) {
  return (Array.isArray(from) ? from : [ from ]).map(function(relpath) {
    // skip non-relative paths (this keeps external module names plain)
    return (relpath.charAt(0) == '.' ? path.resolve(to, relpath) : relpath);
  });
};

exports.resolvePackage = function(to, from) {
  return (Array.isArray(from) ? from : [ from ]).map(function(dep) {
    if (dep.charAt(0) == '.' || dep.charAt(0) == '/') {
      return dep;
    }
    return nodeResolve.sync(dep, { basedir: to });
  });
};

exports.inferMain = function(main, basepath, includes) {
  if (main) {
    return main;
  }
  // update first include (apply inferred basepath)
  var first = (typeof includes === 'string' ? includes : includes[0]),
      firstStat = (fs.existsSync(first) ? fs.statSync(first) : false);

  if (firstStat && firstStat.isFile()) {
    // set main the first include is a file, use it as the main
    return path.relative(basepath, first);
  }
  if (firstStat && firstStat.isDirectory()) {
    // one file in directory
    var content = fs.readdirSync(first).filter(function(file) {
      return path.extname(file) === '.js';
    });
    if (content.length === 1) {
      return path.relative(basepath, first + '/' + content[0]);
    } else if (content.indexOf('index.js') > -1) {
      return path.relative(basepath, first + '/index.js');
    }
  }
  return;
};
