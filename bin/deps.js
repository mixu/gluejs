var path = require('path'),
    Cache = require('minitask').Cache,
    Minilog = require('minilog'),
    DetectiveList = require('../lib/list/detective.js');

Minilog.enable();

var optimist = require('optimist')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'include': { },
      'main': { },
    })
    .boolean('amd'),
    argv = optimist.parse(process.argv);

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

if(!argv['cache-path']) {
  argv['cache-path'] = homePath + path.sep + '.gluejs-cache' + path.sep;
}

// if the cache is disabled, then use a temp path
if(!argv.cache) {
  argv['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
}

var opts = {
  'cache-method': argv['cache-method'] || 'stat',
  'cache-path': argv['cache-path']
};

if(!Array.isArray(argv.include)) {
  argv.include = [ argv.include ];
}


var list = new DetectiveList(opts);

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

  var resultKey = opts['cache-hash'] + '-dependencies-norm';

  var filesByDependendents = {};

  files.forEach(function(item) {
    item.deps = cache.file(item.name).data(resultKey);

    (item.deps || []).forEach(function(name) {
      if(!filesByDependendents[name]) {
        filesByDependendents[name] = [];
      }
      filesByDependendents[name].push(item.name);
    });
  });

  var byDeps = Object.keys(filesByDependendents).map(function(name) {
    return { name: name, deps: filesByDependendents[name] };
  });

  byDeps.sort(function(a, b) {
    return (a.deps && a.deps.length || 0) - (b.deps && b.deps.length || 0);
  });

  byDeps.forEach(function(item) {
    if(item.name.match(/node_modules/)) {
      return;
    }

    console.log(item.name);

    console.log(item.deps);
    console.log();
  });

  cache.end();
});
