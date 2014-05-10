var fs = require('fs'),
    path = require('path');

var log = require('minilog')('to-deps');

module.exports = function(files, basepath, main) {
  var deps = [];
  var id = 1;

  var idLookup = {};

  // use int ids (drawback: can't require() paths)
  /*
  files.forEach(function(file, i) {
    if (!idLookup[file.filename]) {
      idLookup[file.filename] = id++;
    }
  });
  */
  // use relative paths as ids (limitation: can't do flexible lookups, only exact match)
  files.forEach(function(file) {
    if (!idLookup[file.filename]) {
      idLookup[file.filename] = './' + path.relative(basepath, file.filename);
    }
  });

  // set the main module
  var orig = path.normalize(basepath + '/' + main),
      reg = path.normalize(basepath + '/' + main + '.js'),
      packageRootId = idLookup[orig] || idLookup[reg];

  files.forEach(function(file, i) {
    // documented options:
    // - id: can be numeric
    // - source: full source
    // - deps: hash from rawDep to id
    // - entry: true if entry
    // - order: order of entry points
    // undocumented options:
    // - sourceFile: looks like the original file name -- used for source map
    // - nomap: boolean, disables source map for a file -- seems to be set by the dedupe logic
    // in browserify

    // TODO:
    // set the standalone name correctly (UMD exports name also enables UMD)
    var dhash = {};

    var i;
    for (i = 0; i < file.rawDeps.length; i++) {
      // convert deps hash to ids
      if (idLookup[file.deps[i]]) {
        dhash[file.rawDeps[i]] = idLookup[file.deps[i]];
      } else {
        log.warn('Dependency not found', file.deps[i]);
      }
    }

    deps.push({
      id: idLookup[file.filename],
      source:
      (path.extname(file.filename) == '.json' ? 'module.exports = ' : '') +
        fs.readFileSync(file.content).toString(),
      deps: dhash
      // sourceFile: file.filename
    });
    if (idLookup[file.filename] == packageRootId) {
      deps[deps.length - 1].entry = true;
    }
  });

  return [ deps, idLookup, packageRootId];
};
