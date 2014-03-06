#!/usr/bin/env node
var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    Minilog = require('minilog'),
    DetectiveList = require('../lib/detective-list.js'),
    AmdList = require('../lib/amd-list.js'),
    amdetective = require('amdetective'),
    amdresolve = require('amd-resolve'),
    SortDependencies = require('../lib/sort-dependencies.js'),
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

function loadAMDConfig(filepath) {
  // the config specification for RJS is painful to parse as it's not a JSON file
  // but rather a JS file that defines as specifically named variable
  var sandbox = {};
  require('vm').runInNewContext(
    fs.readFileSync(filepath).toString(), sandbox);

  return sandbox.require;
}

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

function lookupDeps(filepath) {
  var key = opts['cache-hash'] + '-amdependencies',
      noCache = false; // for easy dev

  return cache.file(filepath).data(key);
}

function wrapAMD(filepath, basePath) {
  var deps = lookupDeps(filepath),
      // the substr here will not be correct for files under folders which have been mapped unless the path length
      // happens to be identical e.g. app and lib
      relativeName = (path.dirname(filepath) + '/' + path.basename(filepath, path.extname(filepath))).substr(basePath.length + 1);

  return fs.readFileSync(filepath).toString().replace('define(', 'define(' +
    JSON.stringify(relativeName) + ', ' +
    JSON.stringify(deps) + ', '
  );
}

var template = fs.readFileSync(__dirname + '/../lib/amd-vendor-wrap.js').toString();

function wrapAMDVendor(name, filepath, deps, globalName) {
  var result = '';

  if(!filepath) {
    return '';
  }


  if(globalName) {
    result += fs.readFileSync(filepath).toString();
    result += template.replace('%name%', JSON.stringify(name)).replace('%deps%', JSON.stringify(deps)).replace('%global%', globalName);
  } else {

    if(!deps) {
      try {
        deps = amdetective(fs.readFileSync(filepath).toString());
      } catch(e) {
      }
      console.log(deps);
    }

    // assuming: define(function (require, exports, module) {
    // -> define('decode',['require','exports','module'],function (require, exports, module) {
    result += fs.readFileSync(filepath).toString().replace('define(', 'define(' +
      JSON.stringify(name) + ', ' +
      JSON.stringify(deps || ['require','exports','module']) + ', '
    );
  }

  return result;
}

function uniq() {
  var last = null;
  return function(item) {
    // to make a set of sorted keys unique, just check that consecutive keys are different
    var isDuplicate = (item == last);
    last = item;
    return !isDuplicate;
  };
}

console.log('Reading files: ');
(Array.isArray(argv.include) ? argv.include : [ argv.include ]).map(function(filepath) {
  console.log('  ' + filepath);
  list.add(filepath);
});

list.exec(function(err, files) {
  cache.end();
  var errs = list.resolveErrors();
  console.log('done!');

/*
  console.log(errs.map(function(item) {
      return item.dep;
    }).sort());
*/
  console.log(files.length);

  files = files.filter(function(e) {
    return path.basename(e.name) != 'application.js';
  });


  var sorter = new SortDependencies();

  var basePath = path.dirname(argv.config);

  var configjs = loadAMDConfig(argv.config);


  // find the paths of the vendor files
  var vendorNames = Object.keys(configjs.paths);
      vendorPaths = { };

  var missing = errs.map(function(item) {
    return item.dep;
  }).sort().filter(uniq());

  missing.concat(vendorNames).forEach(function(name) {
    if(vendorPaths[name]) {
      return;
    }
    var fullpath = '';

    configjs.relDir = basePath;
    configjs.baseDir = basePath;

    try {
      fullpath = amdresolve.sync(name, configjs);
    } catch(err) { }


    if(fullpath) {
      fullpath = path.normalize(fullpath);
      stat = fs.statSync(fullpath);
      if(stat.isFile()) {
        vendorPaths[name] = fullpath;
      }
    }
  });

  missing = missing.filter(function(name) {
    return !vendorPaths[name];
  });

  // list the still not found items
  var failed = missing.sort().filter(uniq());
  // console.log(vendorPaths, failed);

  // TODO at this point, plug in the config data

  // figure out the actual 3rd party dependencies (from the list) and extract names from paths key
  // Note: the CANONICAL names are from the paths array
  vendorNames.forEach(function(name) {
    sorter.add({ name: name, deps: configjs.shim && configjs.shim[name] && configjs.shim[name].deps || [] });
  });

  var result = '';

  // Use the resolver to output the vendor files first

  sorter.resolve('require');

  console.log('Vendor');
  while(!sorter.isEmpty()) {
    var next = sorter.next();
    console.log('\t' + next.name + (vendorPaths[next.name] ? ' OK' : ''));

    // due to unfilled dep on /v2/config
    if(next.name != 'triconf') {

      var vendorShimEntry = configjs.shim[next.name] || {};

      result += wrapAMDVendor(next.name, vendorPaths[next.name], vendorShimEntry.deps, vendorShimEntry.exports || '');
    }

    sorter.resolve(next);
  }

  // now add the other package files

  files.forEach(function(file) {
    sorter.add({ name: file.name, deps: lookupDeps(file.name) || [] });
  });

  sorter.resolve('require');

  console.log('App');
  while(!sorter.isEmpty()) {
    var next = sorter.next();
    console.log('\t' + next.name);
    result += wrapAMD(next.name, basePath);
    sorter.resolve(next);
  }

  fs.writeFileSync(path.resolve(process.cwd(), './bundle.js'), result);

  /*
  console.log(deps);

  console.log(files.map(function(file) { return file.name + ' ' + lookupDeps(file.name); }));

  console.log(files.length);


  files.map();

  */

  /*
  var inferPackages = require('../lib/list-tasks/infer-packages.js'),
      filterPackages = require('../lib/list-tasks/filter-packages.js');

  inferPackages(list, { main: main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  console.log(util.inspect(list.packages, false, 1, true));
  */
});
