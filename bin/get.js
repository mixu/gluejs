# !/ usr / bin / env node;
var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    Minilog = require('minilog'),
    AmdList = require('../lib/list/amd.js'),
    loadAMDConfig = require('../lib/runner/amd/load-config.js'),
    runner = require('../lib/runner/amd'),
    Cache = require('minitask').Cache,
    nodeResolve = require('resolve');

var optimist = require('optimist')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'include': { },
      'main': { }
    })
    .boolean('amd'),
    argv = optimist.parse(process.argv);

if (!argv['include']) {
  console.log('Usage: --include <file/dir>');
  console.log('Options:');
  console.log('  --amd');
  console.log('  --config');
  console.log('  --vendor');
  console.log('  --main <file>');
  process.exit(1);
}


Minilog.enable();

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

if (!argv['cache-path']) {
  argv['cache-path'] = homePath + path.sep + '.gluejs-cache' + path.sep;
}

// if the cache is disabled, then use a temp path
if (!argv.cache) {
  argv['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
}

var opts = {
  'cache-method': argv['cache-method'] || 'stat',
  'cache-path': argv['cache-path']
};

if (!Array.isArray(argv.include)) {
  argv.include = [argv.include];
}

// determine main
var main = argv.main || argv.include[0],
    basepath = path.resolve(process.cwd(), argv.basepath) || path.dirname(main);

// resolve paths relative to process.cwd
['list-files', 'out', 'vendor-base'].forEach(function(key) {
  if (argv[key]) {
    argv[key] = path.resolve(process.cwd(), argv[key]);
  }
});

// resolve paths relative to basepath
['config', 'vendor'].forEach(function(key) {
  if (argv[key]) {
    argv[key] = path.resolve(basepath, argv[key]);
  }
});

argv.include = argv.include.map(function(p) {
  return path.resolve(basepath, p);
});

// load resources

if (argv.amd) {
  opts.amdresolve = loadAMDConfig(argv.config);
}

if (argv.amd && main) {
  // baseDir is required for AMD
  opts.amdresolve.baseDir = basepath;
}

function findModule(name) {
  var result = '';
  try {
    result = nodeResolve.sync(name, { basedir: process.cwd() });
  } catch (e) {
    try {
      result = nodeResolve.sync(name, { basedir: __dirname });
    } catch (e) {
      console.error('Cannot find module ' + name + ' from ' + process.cwd() + ' or ' + __dirname);
      throw e;
    }
  }
  return result;
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
    if (!fs.existsSync(value)) {
      vendorMap[name] = false;
    }
  });

  // prefix: function(name, filepath) {}
  var plugins = {};

  Object.keys(argv).forEach(function(name) {
    var matched = (typeof name === 'string' ? name.match(/plugin\-(.*)/) : false);
    if (matched) {
      var ext = matched[1];
      argv[name] = findModule(argv[name]);
      plugins[ext] = require(argv[name]);
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
      nomin: vendor.nomin || [],
      plugins: plugins,
      // set this so that builds are invalidated as the version changes
      'gluejs-version': require('../package.json').version
    }, fs.createWriteStream(argv['out']), function(err, processedFiles) {
    if (argv['list-files']) {
      fs.appendFileSync(argv['list-files'], processedFiles.join('\n'));
    }
    cache.end();
  });
});
