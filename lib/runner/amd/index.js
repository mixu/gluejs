var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    runner = require('minitask').runner,
    Cache = require('minitask').Cache,
    // libs
    amdetective = require('amdetective'),
    amdresolve = require('amd-resolve'),
    SortDependencies = require('../../util/sort-dependencies.js'),
    loadAMDConfig = require('./load-config.js'),
    amdDeps = require('./deps.js'),
    // tasks
    wrapAMD = require('../../file-tasks/wrap-amd.js'),
    wrapAMDVendor = require('../../file-tasks/wrap-amd-vendor.js');

function uniq() {
  var prev = null;
  return function(item) {
    var isDuplicate = (item == prev);
    prev = item;
    return !isDuplicate;
  };
}


module.exports = function(list, opts, out, onDone) {
  if(!opts) {
    opts = {};
  }

  var files = list.files,
      configjs = opts.configjs,
      errs = opts.errs,
      cache = Cache.instance({
        method: opts['cache-method'],
        path: opts['cache-path']
      });

  function lookupDeps(filepath) {
    return amdDeps(cache, filepath);
  }

  var sorter = new SortDependencies();


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

    configjs.relDir = opts.basepath;
    configjs.baseDir = opts.basepath;

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

  if(failed.length > 0) {
    console.log('Failed to resolve vendor files:');
    failed.map(function(name) {
      console.log('  ' + name);
    });
    //return onDone();
  }


  // TODO at this point, plug in the config data

  // figure out the actual 3rd party dependencies (from the list) and extract names from paths key
  // Note: the CANONICAL names are from the paths array
  vendorNames.forEach(function(name) {
    sorter.add({ name: name, deps: configjs.shim && configjs.shim[name] && configjs.shim[name].deps || [] });
  });

  var result = '';

  // Use the resolver to output the vendor files first

  sorter.resolve('require');

  // produce the file
  var packageTasks = [];

  console.log('Vendor');
  while(!sorter.isEmpty()) {
    (function() {
      var next = sorter.next();
      console.log('  ' + next.name + (vendorPaths[next.name] ? ' OK' : ''));

      packageTasks.push(function(out, done) {
        // due to unfilled dep on /v2/config
        if(next.name != 'triconf') {
          var vendorShimEntry = configjs.shim[next.name] || {};
          out.write('/* ' + (vendorPaths[next.name] || next.name) + ' */\n');
          out.write(wrapAMDVendor(
            next.name,
            vendorPaths[next.name],
            vendorShimEntry.deps || (vendorPaths[next.name] ? lookupDeps(vendorPaths[next.name]) : undefined),
            vendorShimEntry.exports || ''
          ));
        }
        done();
      });
      sorter.resolve(next);
    }());
  }

  // now add the other package files

  files.forEach(function(file) {
    sorter.add({ name: file.name, deps: lookupDeps(file.name) || [] });
  });

  sorter.resolve('require');

  console.log('App');
  while(!sorter.isEmpty()) {
    (function() {
      var next = sorter.next(),
          relativeName = (path.dirname(next.name) + '/' + path.basename(next.name, path.extname(next.name))).substr(opts.basepath.length + 1);
      console.log('  ' + path.relative(opts.basepath, next.name) + ' ' + sorter.verify(next));
      packageTasks.push(function(out, done) {
        out.write('/* ' + next.name + ' */\n');
        out.write(wrapAMD(next.name, lookupDeps(next.name), opts.basepath));
        done();
      });
      sorter.resolve(relativeName);
    }());
  }

  runner.parallel(packageTasks, {
      cacheEnabled: (opts.cache ? true : false),
      cachePath: opts['cache-path'],
      cacheMethod: opts['cache-method'],
      output: out,
      limit: opts.jobs,
      end: (out !== process.stdout ? true : false), // e.g. no "end" for process.stdout
      onDone: function() {
        if(typeof onDone === 'function') {
          onDone();
        }
      }
  });


};
