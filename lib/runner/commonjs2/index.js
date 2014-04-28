var fs = require('fs'),
    path = require('path'),
    parallel = require('miniq');

var log = require('minilog')('commonjs'),
    checkOptions = require('../../item-tasks/check-options.js'),
    inferPackages = require('../../list-tasks/infer-packages.js'),
    inferPackageDependencies = require('../../list-tasks/infer-package-dependencies.js'),
    reqWrap = require('../../require/index.js'),
    forEachPackage = require('./for-each-package.js');

function uniq() {
  var prev;
  return function(i) {
    var isDup = (i == prev);
    prev = i;
    return !isDup;
  };
}

module.exports = function(opts, onDone) {
  // to make it more likely that all options are documented, only accept options defined here
  if (opts['amd']) {
    throw new Error('packager: --amd is deprecated, please use --umd instead.');
  }

  checkOptions('packager', opts, {
    required: {
      cache: 'instance of minitask.cache',
      files: 'Array of files (array of objects)',
      out: 'writable stream',
      basepath: 'base path for the packages'
    },
    optional: {
      'main': 'Main file',
      'export': 'Exported global name',
      'remap': 'Remapped modules',
      // require format:
      'umd': '',
      'global-require': 'if set, export the root require() function as a global'
    }
  });

  // unpack all opts
  var files = opts.files,
      cache = opts.cache,
      out = opts.out;

  // apply renames:
  // - during dep resolution, browser-require() replaces some files with other files
  // - for those dependencies, the require()ing file has an entry which contains the
  //   original name and the new name
  // - apply the new name by changing the canonical name (while keeping the
  //   renamed content name)

  var renamed = [];
  files.map(function(file) {
    if (file.renames.length > 0) {
      renamed.push(file.renames);
    }
  });

  renamed.forEach(function(pair) {
    var canonical = pair[0],
        renamed = pair[1];
    files.forEach(function(file) {
      // fix the canonical name
      // console.log(renamed, file.filename, file.filename == renamed);
      if (file.filename == renamed) {
        file.filename = canonical;
      }
    });
  });

  // infer packages
  var packages = inferPackages(files, { main: opts.main, basepath: opts.basepath });

  // console.log(require('util').inspect(packages, null, 20, true));

  // infer package deps
  if (false) {
    // for --no-parse:  guess (e.g. modules in folders at higher levels, and one-level-removed child node_modules)
    inferPackageDependencies(tempList, opts);
  } else {
    // for --parse: just collect
    packages.forEach(function(pkg) {
      // full paths
      pkg.fileDeps = pkg.files.reduce(function(prev, file) {
        return prev.concat(file.deps);
      }, [ ]).sort().filter(uniq());
      // raw strings
      pkg.rawDeps = pkg.files.reduce(function(prev, file) {
        return prev.concat(file.rawDeps);
      }, [ ]).sort().filter(uniq());
      // raw strings, filtered by not starting with a `/` or `.`, not having more than one component
      pkg.deps = pkg.rawDeps.filter(function(item) {
        return item.charAt(0) != '/' && item.charAt(0) != '.';
      }).map(function(item) {
        return item.split('/')[0];
      }).sort().filter(uniq());
    });

    // should return both canonical names AND the package index
    // {
    //  ...
    //  deps: [ 'foo', 'bar' ],
    //  fileDeps: [ '/tmp/node_modules/foo/dist/browser.js' ],
    //  rawDeps: [ 'foo', 'foo/bar', ... ],
    // }
    // Lookup:
    // { foo: 1, bar: 2 }

  }

  console.log('With dependencies:');
  console.log(require('util').inspect(packages, null, 20, true));

  // if the main package is empty, use the next one
  // TODO FIXME: this occurs when you are in a ./node_modules/ directory and run
  // a regular build via the command line. Suddenly, the folder you are in is detected as a
  // separate package! Need a better test for this in the long run...
  if (packages[0].files.length === 0) {
    packages.shift();
  }
  if (packages.length === 0) {
    throw new Error('No files were included in the build. Check your `.include()` call paths.');
  }

  // for each package

  var packageTasks = [];

  // create lookup
  var packagesByName = {};
  packages.forEach(function(pkg) {
    if (pkg.name) {
      packagesByName[pkg.name] = pkg;
    }
  });

  packages.forEach(function(packageObj, index) {
    var subtasks = forEachPackage(out, packageObj, index, opts, packagesByName);

    if (subtasks.length === 0) {
      log.info('Excluded non-js/non-json file:', path.relative(packageObj.basepath, item.filename));
      // also update list.files
      removed.push(item.filename);
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
        type: (opts['umd'] ? 'umd' : (opts['node'] ? 'node' : 'global')),
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

    // if any reporting is explicitly enabled
    if (opts.report || opts.verbose || opts.progress) {
      if (cacheHits.length > 0) {
        console.log('Cache hits (' + options['cache-path'] + '):',
          cacheHits.length, '/', list.files.length, 'files');
        // exclude cached files
        list.packages.forEach(function(pack, index) {
          list.packages[index].files = list.packages[index].files.filter(function(item) {
            return cacheHits.indexOf(item.filename) == -1;
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
