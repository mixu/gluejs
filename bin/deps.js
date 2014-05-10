var path = require('path'),
    Cache = require('minitask').Cache,
    Minilog = require('minilog'),
    runTasks = require('../lib/runner/transforms/index.js'),
    loadAMDConfig = require('../lib/runner/amd/load-config.js'),
    toDeps = require('../lib/runner/commonjs3/to-deps.js');

Minilog.enable();

var optimist = require('optimist')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'include': { },
      'main': { },
      'basepath': { }
    }),
    argv = optimist.parse(process.argv);

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

if(!argv['cache-path']) {
  argv['cache-path'] = homePath + path.sep + '.gluejs-cache' + path.sep;
}

// if the cache is disabled, then use a temp path
if(true || !argv.cache) {
  argv['cache-path'] = require('os').tmpDir() + '/gluejs-' + new Date().getTime();
}

var opts = {
  'cache-method': argv['cache-method'] || 'stat',
  'cache-path': argv['cache-path']
};

if(!Array.isArray(argv.include)) {
  argv.include = [ argv.include ];
}

function uniq() {
  var prev = null;
  return function(item) {
    var isDuplicate = (item == prev);
    prev = item;
    return !isDuplicate;
  };
}

var basepath = path.resolve(process.cwd(), argv.basepath);

function resolve(to, from) {
  return (Array.isArray(from) ? from : [ from ]).map(function(relpath) {
    // skip non-relative paths (this keeps external module names plain)
    return (relpath.charAt(0) == '.' ? path.resolve(to, relpath) : relpath);
  });
}

argv.include = resolve(basepath, argv.include);

// Create the shared cache instance
var cache = Cache.instance({
  method: opts['cache-method'],
  path: opts['cache-path']
});
cache.begin();

var amdconfig = loadAMDConfig(argv.amd);
// baseDir is required for AMD
amdconfig.baseDir = basepath;

var depErrs = [];

var Writable = require('readable-stream').Writable,
    util = require('util');

function Capture(options) {
  Writable.call(this, options);
  this.buffer = [];
  this.opts = options;
}

util.inherits(Capture, Writable);

Capture.prototype._write = function(chunk, encoding, done) {
  // marked cannot stream input, so we need to accumulate it here.
  this.buffer.push(chunk);
  done();
};

Capture.prototype.get = function() {
  if (this.opts && this.opts.objectMode) {
    return this.buffer;
  } else {
    return Buffer.concat(this.buffer).toString();
  }
};


// run any tasks and parse dependencies (mapper)
var runner = runTasks({
  cache: cache,
  include: argv.include,
  exclude: [],
  ignore: [],
  jobs: 1,
  'gluejs-version': 1,
  'resolver-opts': { amdconfig: amdconfig }
}, function(err, files) {
  cache.end();

  // errors
  depErrs = depErrs.sort(function(a, b) { return a.dep.localeCompare(b.dep); });
  console.log(depErrs.map(function(item) { return item.dep; }).filter(uniq()));
  // result

  var result = toDeps(files, amdconfig.baseDir, '');
  var deps = result[0];

  // console.log(result);

  var factor = require('factor-bundle');

  var stream = factor([ './a.js', './b.js' ], { objectMode: true, raw: true });

  stream.on('stream', function(s) {
    console.log('STREAM', s.file);
    s.pipe(process.stdout);
  });

  deps.forEach(function(dep) {
    stream.write(dep);
  });

  var capture = new Capture({ objectMode: true })
    .once('finish', function() {
      var arr = capture.get();
      console.log(arr.map(function(dep) {
        var t = JSON.parse(JSON.stringify(dep));
        delete t.source;
        return t;
      }));
    })
    .once('close', function() {
      var arr = capture.get();
      console.log(arr.map(function(dep) {
        var t = JSON.parse(JSON.stringify(dep));
        delete t.source;
        return t;
      }));

    });

  stream.pipe(capture);

  stream.end();


});
runner.on('parse-error', function(err) {
  depErrs.push(err);
});
