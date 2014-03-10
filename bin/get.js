#!/usr/bin/env node
var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    Minilog = require('minilog'),
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

if(!Array.isArray(argv.include)) {
  argv.include = [ argv.include ];
}

// determine main
var main = argv.main || argv.include[0],
    basepath = argv.basepath || path.dirname(main);

// resolve paths relative to process.cwd
['list-files', 'out'].forEach(function(key) {
  if(argv[key]) {
    argv[key] = path.resolve(process.cwd(), argv[key]);
  }
});

// resolve paths relative to basepath
['config', 'vendor'].forEach(function(key) {
  if(argv[key]) {
    argv[key] = path.resolve(basepath, argv[key]);
  }
});

argv.include = argv.include.map(function(p) {
  return path.resolve(basepath, p);
});

// load resources

if(argv.amd) {
  opts.amdresolve = loadAMDConfig(argv.config);
}

if(argv.amd && main) {
  // baseDir is required for AMD
  opts.amdresolve.baseDir = basepath;
}

var list = new AmdList(opts);

var cache = Cache.instance({
    method: opts['cache-method'],
    path: opts['cache-path']
});
cache.begin();

console.log('Reading files: ');
argv.include.forEach(function(filepath) {
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
      exclude: vendor.exclude,
      extras: ['underscore'],
      command: argv.command,
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
    }, fs.createWriteStream(argv['out']), function(err, processedFiles) {
    if(argv['list-files']) {
      fs.appendFileSync(argv['list-files'], processedFiles.join('\n'));
    }
    cache.end();
  });
});
