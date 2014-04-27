var fs = require('fs'),
    path = require('path'),
    parallel = require('miniq');

var log = require('minilog')('commonjs'),
    inferPackages = require('../../list-tasks/infer-packages.js'),
    inferPackageDependencies = require('../../list-tasks/infer-package-dependencies.js'),
    reqWrap = require('../../require/index.js'),
    forEachPackage = require('./for-each-package.js');

module.exports = function(opts, onDone) {
  if (!opts || !opts.list || !opts.cache || !opts.out) {
    throw new Error('packager: opts.list, opts.cache and opts.out are required!');
  }

  // unpack all opts
  var list = opts.list,
      cache = opts.cache,
      out = opts.out;

  // infer packages
  var tempList = {
    files: list.map(function(item) {
      return { name: item.filename };
    })
  };
  inferPackages(tempList, opts); //, { main: opts.main, basepath: basepath });
  var packages = tempList.packages;

  console.log(require('util').inspect(packages, null, 20, true));

  // infer package deps
  if (false) {
    // for --no-parse:  guess (e.g. modules in folders at higher levels, and one-level-removed child node_modules)
    inferPackageDependencies(tempList, opts);
  } else {
    // for --parse: just collect
    // TODO

    // should return both canonical names AND the package index
    // {
    //  ...
    //  normalizedExternalDependencies: [ 'foo', 'bar' ],
    //  externalDependencies: [ 'foo', 'foo/bar', ... ],
    // }
    // Lookup:
    // { foo: 1, bar: 2 }

  }

  console.log('With dependencies:');
  console.log(require('util').inspect(packages, null, 20, true));


  // for each package

  var packageTasks = [];

  packages.forEach(function(packageObj, index) {
    var subtasks = forEachPackage(out, packageObj, index, opts);

    if (subtasks.length === 0) {
      log.info('Excluded non-js/non-json file:', path.relative(packageObj.basepath, item.name));
      // also update list.files
      removed.push(item.name);
      return false; // exclude from package.files
    } else {
      packageTasks = packageTasks.concat(subtasks);
    }
  });

  // join files

  // write the bundle header

  // pluck the main file for the first package
  packageRootFileName = packages[0].main || opts.main;

  if (typeof packageRootFileName === 'undefined') {
    throw new Error('You need to set the package root file explicitly, ' +
      'e.g.: `.main(\'index.js\')` or `--main index.js`. This is the file that\'s exported ' +
      'as the root of the package.');
  }

  // top level boundary + require() implementation
  var wrapOpts = {
        'export': opts['export'] || 'App',
        'root-file': packageRootFileName,
        // `--amd` and `--umd` are synonyms (since umd provides a superset of the amd features)
        type: (opts['amd'] || opts['umd'] ? 'umd' : (opts['node'] ? 'node' : 'global')),
        // options: global-require: export the require() implementation into the global space
        'global-require': opts['global-require'] || false,
        require: (opts.require !== false ? 'min' : 'max')
      };

  out.write(reqWrap.prelude(wrapOpts));
  // the registry definition
  out.write('r.m = [];\n');

  // write the packages
  parallel(1, packageTasks, function(err) {
    // write the bundle footer
    out.write(reqWrap.postlude(wrapOpts));

    delete list.structured;

    // if any reporting is explicitly enabled
    if (opts.report || opts.verbose || opts.progress) {
      if (cacheHits.length > 0) {
        console.log('Cache hits (' + options['cache-path'] + '):',
          cacheHits.length, '/', list.files.length, 'files');
        // exclude cached files
        list.packages.forEach(function(pack, index) {
          list.packages[index].files = list.packages[index].files.filter(function(item) {
            return cacheHits.indexOf(item.name) == -1;
          });
        });
      }
    }
    if (opts.report) {
      require('./report-package.js')(list);
    }

    var ranDone = false;

    // really, avoid closing process.stdout
    if(out === process.stdout) {
      doneFn();
    } else {
      out.end();
      out.once('close', doneFn);
      out.once('finish', doneFn);
    }
    function doneFn() {
      if (!ranDone && typeof onDone === 'function') {
        ranDone = true;
        onDone();
      }
    }
  });
};
