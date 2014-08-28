var fs = require('fs'),
    path = require('path'),
    uniq = require('../util/uniq.js'),
    SortDependencies = require('../util/sort-dependencies.js'),
    wrapAMDVendor = require('../file-tasks/wrap-amd-vendor.js'),
    amdetective = require('amdetective');

module.exports = function(opts, onDone) {
  var files = opts.files,
      configjs = opts.configjs,
      cache = opts.cache;

  function sourceDeps(source) {
    var deps;
    try {
      deps = amdetective(source);
    } catch (e) {
      throw e;
    }
    return normalizeDeps(deps);
  }

  function normalizeDeps(deps) {
    var result = {};
    // normally, amdetective returns an array of strings
    // however, sometimes the parser returns a legacy format: { name: 'jquery', deps: [] }
    deps.forEach(function(dep) {
      if (dep.deps) {
        dep.deps.forEach(function(d) {
          result[d] = d;
        });
      } else {
        result[dep] = dep;
      }
    });
    return result;
  }

  function fileDeps(filepath) {
    // check the cache
    var deps = cache.file(filepath).data('vendorDeps');
    if (typeof deps === 'undefined') {
      deps = sourceDeps(fs.readFileSync(filepath).toString());
      cache.file(filepath).data('vendorDeps', deps);
    }
    return deps;
  }

  // lookup from file path to entry
  var itemLookup = [];
  files.forEach(function(file) {
    if (!itemLookup[file.filename]) {
      itemLookup[file.filename] = file;
    }
  });

  // find deps which remain unresolved
  // by definition this included non-path garbage like AMD plugin paths
  var missingDeps = [];
  files.forEach(function(file) {
    if (!file.deps) {
      return;
    }
    Object.keys(file.deps).forEach(function(dep) {
      var target = file.deps[dep];
      if (!itemLookup[target]) {
        missingDeps.push(target);
      }
    });
  });
  missingDeps = missingDeps.sort().filter(uniq());

  // resolve paths that are remapped via the vendor hash
  missingDeps = missingDeps.filter(function(target) {
    // exclusions
    if (opts.exclude.indexOf(target) > -1) {
      console.log('Excluded vendor entry', target);
      return false;
    }
    if (opts.vendor[target]) {
      var deps = {};

      if (configjs.shim && configjs.shim[target]) {
        // config.js: shim
        if (Array.isArray(configjs.shim[target])) {
          deps = configjs.shim[target].reduce(function(prev, curr) {
            prev[curr] = curr;
            return prev;
          }, {});
        }
        if (configjs.shim[target].deps) {
          deps = configjs.shim[target].deps.reduce(function(prev, curr) {
            prev[curr] = curr;
            return prev;
          }, {});
        }
      } else {
        // parse file
        deps = fileDeps(opts.vendor[target]);
      }

      var file = {
        id: target,
        filename: target,
        sourcePath: opts.vendor[target],
        content: opts.vendor[target],
        deps: deps,
        renames: {},
        isVendor: true // toggles the AMD wrapper mode from "individual file" to "named export"
      };
      console.log('Added vendor entry', target);
      files.push(file);
      return false; // no longer missing
    }

    return true; // retain
  });

  // find and apply plugins
  missingDeps = missingDeps.filter(function(target) {
    // does it contain a exclamation mark?
    var plugin = target.split('!'),
        hasExclamationMark = plugin.length > 1;
    if (opts.plugins && hasExclamationMark && plugin[0]) {
      var pluginName = plugin[0],
          targetPath = opts.vendor[target];

      if (opts.plugins[pluginName]) {
        if (opts.plugins[pluginName].load) {
          targetPath = opts.plugins[pluginName].load(target);
        }
        // can return false from the load() resolution to skip
        if (targetPath) {
          // run the plugin itself
          var source = opts.plugins[pluginName](target, targetPath);
          var file = {
            id: target,
            filename: target,
            sourcePath: targetPath,
            // source attr = don't read file
            source: source,
            deps: sourceDeps(source),
            renames: {}
          };
          files.push(file);
          console.log('Added plugin processed file', target);
        }
        return false; // no longer missing
      }
    }
    return true;
  });

  // attempt resolution anyway for the rest
  function resolveTarget(target) {
    var fullpath = '';

    opts.configjs.relDir = opts.basepath;
    opts.configjs.baseDir = opts.basepath;

    try {
      fullpath = amdresolve.sync(target, opts.configjs);
    } catch (err) { }

    if (fullpath) {
      fullpath = path.normalize(fullpath);
      stat = fs.statSync(fullpath);
      if (stat.isFile()) {
        var file = {
          id: target,
          filename: target,
          content: fullpath,
          deps: vendorDeps(fullpath),
          renames: {}
        };
        files.push(file);
        console.log('Added missing file', target);
        return false; // no longer missing
      }
    }
    return true;
  }
  missingDeps = missingDeps.filter(resolveTarget);

  // list the still not found items
  console.log('Remaining missing', missingDeps);

  // add entries for opts.extras
  opts.extras.forEach(resolveTarget);

  // Properly speaking all the resolution stuff above should take place during the
  // initial parse, e.g. since plugins and other added files might introduce new dependencies

  // sort so that files are in an order that can be loaded safely
  // Use the resolver to determine the order
  var sorter = new SortDependencies();

  files.forEach(function(file) {
    // exclude "require"
    if (file.filename != 'require') {
      sorter.add(file);
    }
  });

  sorter.resolve('require');
  sorter.resolve('exports');
  sorter.resolve('module');

  // the excluded and missing deps should not affect the sort order
  missingDeps.forEach(function(target) {
    sorter.resolve(target);
  });
  opts.exclude.forEach(function(target) {
    sorter.resolve(target);
  });

  var out = opts.out;

  var outputFiles = [];

  var vendorByPath = {};
  Object.keys(opts.vendor).forEach(function(id) {
    var filename = opts.vendor[id];
    vendorByPath[filename] = id;
  });

  // remapped basepaths support (e.g. "core": "../lib/core")
  var basepaths = {};
  basepaths[opts.basepath] = '';
  Object.keys(opts.basepaths).forEach(function(prefix) {
    var stripBase = path.resolve(opts.basepath, opts.basepaths[prefix]);
    basepaths[stripBase] = prefix;
  });

  while (!sorter.isEmpty()) {
    var file = sorter.next(),
        content;

    // wrap each file in AMD

    // canonicalize the target name so it matches the resolver name
    // normal files don't have ids yet
    if (!file.id) {
      // is it a vendor file? Vendor files should use their name in the vendor hash as their
      // file.id - and since amdresolve may have resolved them earlier already (as amdresolve is
      // just extracted from r.js, it is not very configurable), detect this.
      if (vendorByPath[file.filename]) {
        file.id = vendorByPath[file.filename];
      } else {
        var hasKnownBasepath = Object.keys(basepaths).some(function(stripBase) {
              var isMatch = (file.filename.substr(0, stripBase.length) == stripBase);
              if (isMatch) {
                var noExtension = (path.dirname(file.filename) + '/' + path.basename(file.filename, path.extname(file.filename))),
                    relative = path.relative(stripBase, noExtension);
                file.id = basepaths[stripBase] + (relative.charAt(0) == '/' ? relative : '/' + relative);
                if (file.id.charAt(0) == '/') {
                  file.id = file.id.substr(1);
                }
              }
              return isMatch;
            });
        if (!hasKnownBasepath) {
          var str = 'WARN: Unknown basepath - file cannot be included: ' + file.filename;
          console.error(str);
          throw new Error(str);
        } else {
          //console.log(file.filename, '=>', file.id);
        }
      }
    }
    console.log('  ' + file.id + ' (' + sorter.verify(file) + ') ');

    // has this file been processed as a plugin?
    if (file.source) {
      out.write(file.source);
      outputFiles.push(file.sourcePath ? file.sourcePath : file.filename);
      sorter.resolve(file.id);
      continue;
    }

    // else run wrapping
    try {
      content = fs.readFileSync(file.content);
    } catch (e) {
      console.error('Could not read source file', file.content);
      continue;
    }

    if (file.isVendor) {
      out.write(wrapAMDVendor(
        file.id,
        content,
        Object.keys(file.deps),
        (opts.configjs.shim && opts.configjs.shim[file.id] ? opts.configjs.shim[file.id].exports : undefined) || ''
      ));
    } else {
      out.write(wrapAMDVendor(
        file.id,
        content,
        Object.keys(file.deps),
        false
      ));
    }
    outputFiles.push(file.sourcePath ? file.sourcePath : file.filename);

    sorter.resolve(file.id);
  }
  return onDone(null, outputFiles);
};
