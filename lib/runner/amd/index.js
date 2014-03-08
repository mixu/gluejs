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
      vendorPaths = opts.vendor || { },
      vendorComplete = {};

  var missing = errs.map(function(item) {
    return item.dep;
  }).sort().filter(uniq());
  var desired = JSON.parse(JSON.stringify(missing));

  // search for vendor file paths using amdresolve and process `foo!path` directives

  missing.concat(vendorNames).forEach(function(name) {
    // does it contain a exclamation mark?
    var plugin = name.split('!'),
        hasExclamationMark = plugin.length > 1;
    if (hasExclamationMark && plugin[0] && vendorPaths[name]) {
      var pluginName = plugin[0],
          pluginPath = vendorPaths[name];

      if (opts.plugins && opts.plugins[pluginName]) {
        vendorComplete[name] = opts.plugins[pluginName](name, pluginPath);
        return;
      }
    }
    // is it defined
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
    var hasPath = vendorPaths[name],
        isIgnored = (typeof vendorPaths[name] === 'boolean' && vendorPaths[name])
        hasExternal = vendorComplete[name];
    return !isIgnored && !hasPath && !hasExternal;
  });

  // list the still not found items
  var failed = missing.sort().filter(uniq());

  if(failed.length > 0) {
    console.log('Failed to resolve vendor files:');
    var tmplObj = {}
    failed.map(function(name) {
      tmplObj[name] = '';
    });
    console.log(JSON.stringify(tmplObj, null, 2));
    //return onDone();
  }

  // TODO at this point, plug in the config data

  function vendorDeps(name) {
    if(!configjs.shim || !configjs.shim[name]) {
      return [];
    }
    if(Array.isArray(configjs.shim[name])) {
      return configjs.shim[name];
    }
    if (configjs.shim[name].deps) {
      return configjs.shim[name].deps;
    }
    if (vendorPaths[name]) {
      return lookupDeps(vendorPaths[name]) || [];
    }
    return [];
  }

  // figure out the actual 3rd party dependencies (from the list) and extract names from paths key
  // Note: the CANONICAL names are from the paths array
  var allDeps = vendorNames
    .concat(opts.extras, desired.filter(function(i) { return !missing[i]; }))
    .sort()
    .filter(uniq());
  allDeps.forEach(function(name) {
    sorter.add({ name: name, deps: vendorDeps(name) });
  });

  var result = '';

  // Use the resolver to output the vendor files first

  sorter.resolve('require');

  // produce the file
  var packageTasks = [];

  var excluded = opts.excluded || [];

  console.log('Vendor');
  while(!sorter.isEmpty()) {
    (function() {
      var next = sorter.next();
      // due to unfilled dep on /v2/config
      if(excluded.indexOf(next.name) == -1 && vendorPaths[next.name]) {
        var moduleName = next.name;
        console.log('  ' + moduleName + ' (' + vendorPaths[next.name] + ') ' + sorter.verify(next));

        packageTasks.push(function(out, done) {
          var vendorShimEntry = configjs.shim[next.name] || {};

          out.write('/* ' + moduleName  + ' via ' + (vendorPaths[next.name] || next.name) + ' */\n');
          if(vendorComplete[next.name]) {
            out.write(vendorComplete[next.name]);
          } else {
            out.write(wrapAMDVendor(
              moduleName,
              vendorPaths[next.name],
              vendorDeps(next.name),
              vendorShimEntry.exports || ''
            ));
          }
          done();
        });
      }
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
        out.write('/* ' + relativeName + ' via '+ next.name + ' */\n');
        if(vendorComplete[next.name]) {
          out.write(vendorComplete[next.name]);
        } else {
          out.write(wrapAMD(next.name, lookupDeps(next.name), opts.basepath));
        }
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
