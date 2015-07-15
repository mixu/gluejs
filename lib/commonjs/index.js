var fs = require('fs'),
    path = require('path');

var toDeps = require('./to-deps.js'),
    WrapCJS = require('./wrap-cjs.js');

module.exports = function(opts, onDone) {
  var files = opts.files,
      out = opts.out,
      main = opts.main,
      basepath = opts.basepath;

  var result = toDeps({
    files: opts.files,
    basepath: opts.basepath,
    main: opts.main,
    ignore: opts.ignore,
    exclude: opts.exclude,
    remap: opts.remap,
    'source-map': opts['source-map']
  });

  var deps = result[0],
      idLookup = result[1],
      packageRootId = result[2];

  if (typeof packageRootId === 'undefined') {
    throw new Error('Could not determine the package main file. Please make sure that the ' +
      'first --include target is a file.');
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


  var pack = require('browser-pack');

  var stream = pack({ raw: true, sourceMapPrefix: '//#' });

  stream.pipe(new WrapCJS({
    standalone: opts.global,
    mainModule: packageRootId
  })).pipe(out);

  deps.forEach(function(dep) {
    stream.write(dep);
  });

  stream.end();

};
