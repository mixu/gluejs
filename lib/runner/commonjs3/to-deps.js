var fs = require('fs'),
    path = require('path');

var log = require('minilog')('to-deps'),
    Matcher = require('./match.js'),
    uniq = require('../../util/uniq.js');

module.exports = function(opts) {
  var files = opts.files,
      basepath = opts.basepath,
      main = opts.main,
      sourceMapEnabled = opts['source-map'],
      ignores = opts.ignore,
      excludes = opts.exclude,
      remapped = opts.remap;

  var deps = [];
  var id = 1;

  var isIgnored = new Matcher(ignores, { basepath: basepath }),
      isExcluded = new Matcher(excludes, { basepath: basepath });

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

  // handle duplicate files
  var byContent = {},
      canonicalName = {};
  files.forEach(function(file) {
    if (!byContent[file.content]) {
      byContent[file.content] = [file];
    } else {
      byContent[file.content].push(file);
    }
  });

  var ignoredIds = [],
      notFound = {};

  files.forEach(function(file) {
    // documented options:
    // - id: can be numeric
    // - source: full source
    // - deps: hash from depName to target
    // - entry: true if entry
    // - order: order of entry points
    // undocumented options:
    // - sourceFile: looks like the original file name -- used for source map
    // - nomap: boolean, disables source map for a file -- seems to be set by the dedupe logic
    // in browserify

    // TODO:
    // set the standalone name correctly (UMD exports name also enables UMD)
    var dhash = {};

    Object.keys(file.deps).forEach(function(depName) {
      var target = file.deps[depName];
      // convert deps hash to ids
      if (idLookup[target]) {
        dhash[depName] = idLookup[target];
      } else if (remapped[depName]) {
        // --remap works by excluding references to a specific string
        dhash[depName] = depName;
      } else if (isIgnored(target)) {
        // --ignore all items where the resolved path is a ignored path
        dhash[depName] = '__ignore';
        ignoredIds.push('__ignore');
      } else {
        // missing dependency target, and it is not ignored or remapped => warn
        if (!notFound[depName]) {
          notFound[depName] = { target: target, as: depName, from: [file.filename] };
        } else {
          notFound[depName].from.push(file.filename);
        }
      }
    });

    var source,
        isDuplicate = byContent[file.content].length > 1,
        isMainFile = false;
    if (isDuplicate) {
      // prefer the shortest name
      if (!canonicalName[file.content]) {
        canonicalName[file.content] = byContent[file.content].map(function(file) {
          return file.content;
        }).sort(function(name) { return name.length; })[0];
      }
      isMainFile = (canonicalName[file.content] != file.filename);
    }
    // for duplicates which are not the main file
    if (isDuplicate && isMainFile) {
      source = 'module.exports=require(\'' + idLookup[canonicalName[file.content]] + '\');';
      // console.log('dup', file.filename, '=>', canonicalName[file.content]);
    } else {
      source = (path.extname(file.filename) == '.json' ? 'module.exports = ' : '') +
        fs.readFileSync(file.content).toString();
    }
    var dep = {
      id: idLookup[file.filename],
      source: source,
      deps: dhash
    };
    if (sourceMapEnabled && !isDuplicate || (isDuplicate && isMainFile)) {
      dep.sourceFile = file.filename;
    }
    deps.push(dep);

    if (idLookup[file.filename] == packageRootId) {
      deps[deps.length - 1].entry = true;
    }
  });

  // always insert every remapped name entry
  // sometimes the remapped things don't actually exist in the package itself,
  // but we still want an entry for them (e.g. --remap jquery=window.jq) where
  // jquery is not even on the file systems
  Object.keys(remapped).forEach(function(id) {
    // store remapped references (also includes ignored names)
    deps.push({
      id: id,
      source: 'module.exports = ' + remapped[id] + ';',
      nomap: true
    });
    idLookup[id] = id;
    log.info('Remap: Add', id, '=>', remapped[id]);
  });

  ignoredIds.sort().filter(uniq()).forEach(function(id) {
    deps.push({
      id: id,
      source: 'module.exports = {};',
      nomap: true
    });
    log.info('Ignore: Add', id, '=>', '{}');
    idLookup[id] = id;
  });

  var idsReverse = {};
  Object.keys(idLookup).forEach(function(key) { idsReverse[idLookup[key]] = key; });

  deps.forEach(function(dep) {
    if (dep.deps) {
      Object.keys(dep.deps).forEach(function(name) {
        var target = dep.deps[name];
        if (!idsReverse[target]) {
          log.warn('Missing require(', name, ') => ', target, 'from', dep.id);
        }
      });
    }
  });

  if (Object.keys(notFound).length > 0) {
    log.warn('Dependencies not found:');
    Object.keys(notFound).forEach(function(key, i) {
      var value = notFound[key];
      log.warn(' ' + i + ')', value.target, 'as', value.as, 'from:',
        value.from.length + ' files');
    });
  }

  return [deps, idLookup, packageRootId];
};
