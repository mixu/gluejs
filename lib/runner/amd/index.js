var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    runner = require('minitask').runner,
    Task = require('minitask').Task,
    Cache = require('minitask').Cache,
    // libs
    amdetective = require('amdetective'),
    amdresolve = require('amd-resolve'),
    SortDependencies = require('../../util/sort-dependencies.js'),
    loadAMDConfig = require('./load-config.js'),
    amdDeps = require('./deps.js'),
    spawn = require('../../file-tasks/spawn.js'),
    // tasks
    wrapAMDVendor = require('../../file-tasks/wrap-amd-vendor.js'),
    log = require('minilog')('amd');

function uniq() {
  var prev = null;
  return function(item) {
    var isDuplicate = (item == prev);
    prev = item;
    return !isDuplicate;
  };
}

module.exports = function(list, opts, out, onDone) {
  if (!opts) {
    opts = {};
  }

  var files = list.files,
      configjs = opts.configjs,
      errs = opts.errs,
      cache = Cache.instance({
        method: opts['cache-method'],
        path: opts['cache-path']
      }),
      sorter = new SortDependencies(),
      // find the paths of the vendor files
      vendorNames = Object.keys(configjs.paths),
      vendorPaths = opts.vendor || { },
      vendorComplete = {},
      processedFiles = [],
      optsHash = Cache.hash(JSON.stringify(opts));

  var missing = errs.map(function(item) {
    return item.dep;
  }).sort().filter(uniq());
  var desired = JSON.parse(JSON.stringify(missing));

  // search for vendor file paths using amdresolve and process `foo!path` directives

  missing.concat(vendorNames).forEach(function(name) {
    // does it contain a exclamation mark?
    var plugin = name.split('!'),
        hasExclamationMark = plugin.length > 1;
    if (hasExclamationMark && plugin[0]) {
      var pluginName = plugin[0],
          pluginPath = vendorPaths[name];

      if (opts.plugins && opts.plugins[pluginName]) {
        if (opts.plugins[pluginName].load) {
          vendorPaths[name] = pluginPath = opts.plugins[pluginName].load(name);
          console.log(name, vendorPaths[name]);
        }
        // can return false from the load() resolution to skip
        if (!vendorPaths[name]) {
          return;
        }
        vendorComplete[name] = opts.plugins[pluginName](name, pluginPath);
        return;
      }
    }
    // is it defined
    if (vendorPaths[name]) {
      return;
    }
    var fullpath = '';

    configjs.relDir = opts.basepath;
    configjs.baseDir = opts.basepath;

    try {
      fullpath = amdresolve.sync(name, configjs);
    } catch (err) { }


    if (fullpath) {
      fullpath = path.normalize(fullpath);
      stat = fs.statSync(fullpath);
      if (stat.isFile()) {
        vendorPaths[name] = fullpath;
      }
    }
  });

  missing = missing.filter(function(name) {
    var hasPath = vendorPaths[name],
        isIgnored = (typeof vendorPaths[name] === 'boolean' && vendorPaths[name]),
        hasExternal = vendorComplete[name];
    return !isIgnored && !hasPath && !hasExternal;
  });

  // list the still not found items
  var failed = missing.sort().filter(uniq());

  if (failed.length > 0) {
    console.log('Failed to resolve vendor files:');
    var tmplObj = {};
    failed.map(function(name) {
      tmplObj[name] = '';
    });
    console.log(JSON.stringify(tmplObj, null, 2));
    //return onDone();
  }

  function vendorDeps(name) {
    var items = [];
    if (configjs.shim && configjs.shim[name]) {
      if (Array.isArray(configjs.shim[name])) {
        items = configjs.shim[name];
      }
      if (configjs.shim[name].deps) {
        items = configjs.shim[name].deps;
      }
    } else if (vendorPaths[name]) {
      items = amdDeps(cache, vendorPaths[name]);
    }
    var result = [];
    // some modules return a legacy format:  { name: 'jquery', deps: [] }
    items.forEach(function(dep) {
      if (dep.deps) {
        dep.deps.forEach(function(d) {
          result.push(d);
        });
      } else {
        result.push(dep);
      }
    });
    return result;
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

  // Use the resolver to output the vendor files first

  sorter.resolve('require');
  sorter.resolve('exports');
  sorter.resolve('module');

  // produce the file
  var packageTasks = [];

  var exclude = opts.exclude || [];

  console.log('Vendor');

  function processVendor() {
    var next = sorter.next(),
        moduleName = next.name,
        filepath = vendorPaths[moduleName];
    if (exclude.indexOf(moduleName) == -1 && filepath) {
      console.log('  ' + moduleName + ' (' + vendorDeps(moduleName).join(', ') + ') ' + sorter.verify(next));

      packageTasks.push(function(out, done) {
        //out.write('/* ' + moduleName  + ' */\n');
        processedFiles.push(filepath);
        done();
      });

      if (vendorComplete[moduleName]) {
        packageTasks.push(function(out, done) {
          out.write(vendorComplete[moduleName]);
          done();
        });
        return;
      }

      var tasks = [];

      // "simple mode": one --command which only applies to .js files
      if (opts.command && path.extname(filepath) == '.js' && opts.nomin.indexOf(moduleName) == -1) {
        tasks.push(function() {
          return spawn({
            name: filepath, // full path
            task: opts.command
          });
        });
      }

      tasks.push(function(input, done) {
        done(null, wrapAMDVendor(
          moduleName,
          input,
          vendorDeps(moduleName),
          (configjs.shim && configjs.shim[moduleName] ? configjs.shim[moduleName].exports : undefined) || ''
        ));
      });

      var task = new Task(tasks).input(function() {
        return fs.createReadStream(filepath);
      });

      // these are used to disambiguate cached results
      task.inputFilePath = filepath;
      task.taskHash = optsHash;

      task.once('hit', function() {
      });

      task.once('miss', function() {
        log.info('  Processing file', filepath);
      });

      packageTasks.push(task);
    }
    sorter.resolve(moduleName);
  }

  while (!sorter.isEmpty()) {
    process();
  }

  // now add the other package files

  files.forEach(function(file) {
    sorter.add({ name: file.name, deps: amdDeps(cache, file.name) || [] });
  });

  sorter.resolve('require');

  console.log('App');
  function processApp() {
    var next = sorter.next(),
        filepath = next.name,
        // the substr here will not be correct for files under folders which have been mapped unless the path length
        // happens to be identical e.g. app and lib
        moduleName = (path.dirname(filepath) + '/' +
          path.basename(filepath, path.extname(filepath))).substr(opts.basepath.length + 1);
    console.log('  ' + path.relative(opts.basepath, filepath) + ' ' + sorter.verify(next));

    packageTasks.push(function(out, done) {
      // out.write('/* ' + moduleName + ' */\n');
      processedFiles.push(filepath);
      done();
    });

    if (vendorComplete[filepath]) {
      packageTasks.push(function(out, done) {
        out.write(vendorComplete[filepath]);
        done();
      });
      return;
    }

    var tasks = [];

    // "simple mode": one --command which only applies to .js files
    if (opts.command && path.extname(filepath) == '.js' && opts.nomin.indexOf(moduleName) == -1) {
      tasks.push(function() {
        return spawn({
          name: filepath, // full path
          task: opts.command
        });
      });
    }

    tasks.push(function(input, done) {
      done(null, wrapAMDVendor(moduleName, input, amdDeps(cache, filepath), false));
    });

    var task = new Task(tasks).input(function() {
      return fs.createReadStream(filepath);
    });

    // these are used to disambiguate cached results
    task.inputFilePath = filepath;
    task.taskHash = optsHash;

    task.once('hit', function() {
    });

    task.once('miss', function() {
      log.info('  Processing file', filepath);
    });

    packageTasks.push(task);

    sorter.resolve(moduleName);
  }
  while (!sorter.isEmpty()) {
    processApp();
  }

  runner.parallel(packageTasks, {
      cacheEnabled: (opts.cache ? true : false),
      cachePath: opts['cache-path'],
      cacheMethod: opts['cache-method'],
      output: out,
      limit: opts.jobs,
      end: (out !== process.stdout ? true : false), // e.g. no "end" for process.stdout
      onDone: function() {
        if (typeof onDone === 'function') {
          onDone(null, processedFiles);
        }
      }
  });
};
