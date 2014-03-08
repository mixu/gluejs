#!/usr/bin/env node
var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    Minilog = require('minilog'),
    DetectiveList = require('../lib/list/detective.js'),
    AmdList = require('../lib/list/amd.js'),
    loadAMDConfig = require('../lib/runner/amd/load-config.js'),
    runner = require('../lib/runner/amd'),
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
  console.log('  --config');
  console.log('  --vendor');
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

if(argv.amd) {
  opts.amdresolve = loadAMDConfig(argv.config);
}

if(argv.amd && main) {
  // baseDir is required for AMD
  opts.amdresolve.baseDir = path.dirname(main);
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
  console.log('Processing ' + files.length + ' files.');

  var vendor = require(path.resolve(process.cwd(), argv.vendor));
  var vendorMap = vendor.paths;

  // resolve relative to --vendor-base
  Object.keys(vendorMap).forEach(function(name) {
    var value = vendorMap[name];
    if (typeof value === 'string' && value.charAt(0) == '.') {
      vendorMap[name] = path.resolve(argv['vendor-base'], value);
    }
  });
  Object.keys(vendorMap).forEach(function(name) {
    var value = vendorMap[name];
    if(!fs.existsSync(value)) {
      vendorMap[name] = false;
    }
  });

  runner({ files: files }, {
      main: argv.main,
      basepath: basepath,
      configjs: opts.amdresolve,
      errs: list.resolveErrors(),
      'cache-method': opts['cache-method'],
      'cache-path': opts['cache-path'],
      cache: true,
      jobs: require('os').cpus().length * 2,
      vendor: vendorMap,
      excluded: vendor.excluded,
      extras: ['underscore'],
      plugins: {
        'jade': function(name, filepath) {
          var jade = require('jade');
          return "define('" + name + "', ['jade-runtime'], function(jade){ return " +
            jade.compile(fs.readFileSync(filepath).toString(), { client: true, compileDebug: false }) + "});\n";
        },
        'json': function(name, filepath) {
          return "define('" + name + "', [], function(){ return " +
            fs.readFileSync(filepath).toString() + "});\n";
        }
      }
    }, fs.createWriteStream(path.resolve(process.cwd(), './bundle.js')), function() {
    cache.end();
  });

/*
  console.log(errs.map(function(item) {
      return item.dep;
    }).sort());
*/

  files = files.filter(function(e) {
    return path.basename(e.name) != 'application.js';
  });

  /*
  var inferPackages = require('../lib/list-tasks/infer-packages.js'),
      filterPackages = require('../lib/list-tasks/filter-packages.js');

  inferPackages(list, { main: main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  console.log(util.inspect(list.packages, false, 1, true));
  */
});
