var path = require('path'),
    Cache = require('minitask').Cache,
    Minilog = require('minilog'),
    runTasks = require('../lib/runner/transforms/index.js'),
    loadAMDConfig = require('../lib/runner/amd/load-config.js'),
    toDeps = require('../lib/runner/commonjs3/to-deps.js'),
    uniq = require('../lib/util/uniq.js'),
    Capture = require('../lib/file-tasks/capture.js');

Minilog.enable();

var yargs = require('yargs')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'include': { },
      'basepath': { }
    }),
    argv = yargs.parse(process.argv);

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

if(!argv['cache-path']) {
  argv['cache-path'] = homePath + path.sep + '.gluejs-cache' + path.sep;
}

// if the cache is disabled, then use a temp path
if(true || !argv.cache) {
  argv['cache-path'] = require('os').tmpDir() + '/gluejs-' + new Date().getTime();
}

var opts = JSON.parse(JSON.stringify(argv));
opts['cache-method'] = argv['cache-method'] || 'stat';

// basepath
opts.basepath = resolveOpts.inferBasepath(argv.basepath, argv.include);
// relative paths
[ 'ignore', 'include', 'exclude' ].forEach(function(key) {
  if (opts[key]) {
    opts[key] = resolveOpts.resolve(opts.basepath, opts[key]);
  }
});
// main file
opts.main = resolveOpts.inferMain(opts.basepath, opts.include);

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
