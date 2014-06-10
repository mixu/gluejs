var fs = require('fs'),
    path = require('path');

var toDeps = require('./to-deps.js'),
    WrapCJS = require('./wrap-cjs.js');

module.exports = function(opts, onDone) {
  var files = opts.files,
      out = opts.out,
      main = opts.main,
      basepath = opts.basepath;

  var result = toDeps(files, basepath, main, [].concat(opts.ignore, opts.exclude));

  var deps = result[0],
      idLookup = result[1],
      packageRootId = result[2];

  if (typeof packageRootId === 'undefined') {
    console.log('FILES', files);
    console.log('MAIN', main, basepath);
    throw new Error('You need to set the package root file explicitly, ' +
      'e.g.: `.main(\'index.js\')` or `--main index.js`. This is the file that\'s exported ' +
      'as the root of the package.');
  }

  // store remapped references
  if (opts.remap) {
    Object.keys(opts.remap).forEach(function(name) {
      deps.push({
        id: name,
        source: 'module.exports = ' + opts.remap[name] + ';',
        nomap: true
      });
    });
  }
  if (opts.ignore) {
    opts.ignore.forEach(function(name) {
      if (!idLookup[name]) {

        deps.push({
          id: name,
          source: 'module.exports = {};',
          nomap: true
        });
      }
    });
  }
  // expose the base filename
  // TODO: make this less verbose
  /*
  var idsReverse = {};
  Object.keys(idLookup).forEach(function(key) { idsReverse[idLookup[key]] = key; });

  files.forEach(function(file) {
    var dirname = './' + path.relative(basepath, path.dirname(file.filename)),
        extname = path.extname(file.filename),
        basename = path.basename(file.filename, extname);

    if (dirname.charAt(dirname.length - 1) != '/') {
      dirname += '/';
    }

    var variations = [
      dirname + basename,
      dirname + basename + extname
    ];

    if (basename == 'index') {
      variations.push(dirname);
      variations.push(dirname.substr(0, dirname.length - 1));
    }

    variations.forEach(function(name) {
      if (idsReverse[name]) {
        return;
      }
      deps.push({
          id: name,
          deps: {},
          source: 'module.exports=require(\'' +
              idLookup[file.filename] + '\');',
          nomap: true
      });
    });
  });
*/

  // console.log(deps);
  // console.log(deps.map(function(dep) {
  //   var t = JSON.parse(JSON.stringify(dep));
  //   delete t.source;
  //   return t;
  // }));

/*
  deps.map(function(dep) {
    var t = JSON.parse(JSON.stringify(dep));
    delete t.source;
    return t.id;
  }).sort().forEach(function(name) {
    console.log(name);
  });
*/
//  return;


  idsReverse = {};
  Object.keys(idLookup).forEach(function(key) { idsReverse[idLookup[key]] = key; });

  deps.forEach(function(dep) {
    if (dep.deps) {
      Object.keys(dep.deps).forEach(function(name) {
        var target = dep.deps[name]
        if (!idsReverse[target]) {
          console.log('Missing require(', name, ') => ', target, 'from', dep.id);
        }
      });
    }
  });

  var pack = require('browser-pack');

  var stream = pack({ raw: true, sourceMapPrefix: '//#' });

  stream.pipe(new WrapCJS({
    standalone: 'foo',
    mainModule: packageRootId
  })).pipe(out);

  deps.forEach(function(dep) {
    stream.write(dep);
  });

  stream.end();

};
