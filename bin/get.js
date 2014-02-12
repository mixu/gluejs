#!/usr/bin/env node
var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    Minilog = require('minilog'),
    DetectiveList = require('../lib/detective-list.js'),
    AmdList = require('../lib/amd-list.js'),
    Cache = require('minitask').Cache;

var opts = require('optimist')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'include': { },
      'main': { },
    })
    .boolean('amd'),
    argv = opts.parse(process.argv);

if(!argv['include']) {
  console.log('Usage: --include <file/dir>');
  console.log('Options:');
  console.log('  --amd');
  console.log('  --main <file>');
  process.exit(1);
}


Minilog.enable();

opts = {
  'cache-method': 'stat',
  'cache-path': os.tmpDir() + '/gluejs-' + new Date().getTime()
};

// determine main
var main = argv.main || Array.isArray(argv.include) ? argv.include[0] : argv.include,
    basepath = path.dirname(main);

if(argv.amd && main) {
  // baseDir is required for AMD
  opts.baseDir = path.dirname(main);
}

var list = (argv.amd ? new AmdList(opts) : new DetectiveList(opts));

var cache = Cache.instance({
    method: opts['cache-method'],
    path: opts['cache-path']
});
cache.begin();

console.log('Reading files: ');
(Array.isArray(argv.include) ? argv.include : [ argv.include ]).map(function(filepath) {
  console.log('  ' + filepath);
  list.add(filepath);
});

list.exec(function(err, files) {
  cache.end();
  var errs = list.resolveErrors(),
      failed = {};

  errs.forEach(function(err) {
    failed[err.dep] = true;
  });

  console.log(Object.keys(failed));
  console.log('done!');

  console.log(files.map(function(file) { return file.name; }));

  /*
  var inferPackages = require('../lib/list-tasks/infer-packages.js'),
      filterPackages = require('../lib/list-tasks/filter-packages.js');

  inferPackages(list, { main: main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  console.log(util.inspect(list.packages, false, 1, true));
  */
});
