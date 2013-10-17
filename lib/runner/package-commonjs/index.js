var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    runner = require('minitask').runner,
    Flow = require('minitask').Task,
    Cache = require('minitask').Cache,
    // tasks
    annotateStat = require('../../list-tasks/annotate-stat.js'),
    inferPackages = require('../../list-tasks/infer-packages.js'),
    filterNpm = require('../../list-tasks/filter-npm.js'),
    filterRegex = require('../../list-tasks/filter-regex.js'),
    filterPackages = require('../../list-tasks/filter-packages.js'),
    getFileTasks = require('./get-file-tasks.js'),
    getCommands = require('./get-commands.js'),

    log = require('minilog')('package-commonjs');

// this runner concatenates the files to stdout after running wrap-commonjs-web
module.exports = function(list, options, out, onDone) {
  if(!options) {
    options = {};
  }
  // unpack options
  var exportVariableName = options['export'] || 'foo',
      packageRootFileName,
      // normalize basepath
      basepath = (options.basepath ? path.normalize(options.basepath) : ''),
      // replaced modules (e.g. jquery => window.jquery)
      replaced = Object.keys(options.replaced || {}).map(function(key) {
        return JSON.stringify(key) + ': '+ '{ exports: ' + options.replaced[key] + ' }'
      }).join(',\n'),
      // remapped modules (e.g. assert => require('chai').assert
      remapped = Object.keys(options.remap || {}).map(function(key) {
        return JSON.stringify(key) + ': '+ 'function(module, exports, require) { module.exports = ' + options.remap[key] + ' }';
      }).join(',\n'),
      // commands
      commands = getCommands(options),

      // cache hit filepaths for reporting
      cacheHits = [],
      optsHash = Cache.hash(JSON.stringify(options));

  // console.log(util.inspect(list.files.map(function(item) { return item.name; }), false, 20, true));

  // exclude files using the npmjs defaults for file and path exclusions
  filterNpm(list);
  // exclude files matching specific expressions
  // - because .npmignores often do not cover all the files to exclude
  var excludeList = [
    new RegExp('\/dist\/'),
    new RegExp('\/example\/'),
    new RegExp('\/benchmark\/'),
    new RegExp('[-.]min.js$')
  ];

  // allow --reset-exclude
  if(options['reset-exclude']) {
    excludeList = [];
  }

  // allow adding in expressions
  if(options['exclude']) {
    excludeList = excludeList.concat(
      (Array.isArray(options['exclude']) ? options['exclude'] : [ options['exclude'] ]).map(function(expr) {
        return new RegExp(expr);
      })
    );
  }

  filterRegex(list, excludeList);

  annotateStat(list);

  // run list level tasks

  // - generate `.packages` from `.files` (by grouping the set of `.files` into distinct dependencies)
  //   ... and infer the package main file
  inferPackages(list, { main: options.main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  // console.log(util.inspect(list, false, 20, true));

  // if the main package is empty, use the next one
  // TODO FIXME: this occurs when you are in a ./node_modules/ directory and run
  // a regular build via the command line. Suddenly, the folder you are in is detected as a
  // separate package! Need a better test for this in the long run...
  if(list.packages[0].files.length === 0) {
    list.packages.shift();
  }
  if(list.packages.length === 0) {
    throw new Error('No files were included in the build. Check your `.include()` call paths.');
  }

  // pluck the main file for the first package
  packageRootFileName = list.packages[0].main;

  // filter out non-JS files
  var removed = [];
  // find the ignore files (applying them in the correct order)
  var whitelist = [
    /(\.js|\.json)$/
  ];
  // if a command is applied to non-js files, then do not exclude them
  if(Array.isArray(options.command)) {
    options.command.forEach(function(command) {
      if(command.expr) {
        // add expression to whitelist
        whitelist.push(command.expr);
      } else if (command.ext) {
        // add extension to whitelist
        whitelist.push({
          test: function(str) {
            return str.substr(str.length - command.ext.length).toLowerCase() == command.ext;
          }
        });
      }
    });
  }
  function traverse(packageObj) {
    packageObj.files = packageObj.files.filter(function(item) {
      var result = (whitelist.some(function(expr) {
        return expr.test(item.name);
      }));
      // also update list.files
      if(!result) {
        removed.push(item.name);
        log.info('Excluded non-js/non-json file', item.name);
      }
      return result;
    });
  }

  list.packages.forEach(traverse);

  // update files
  list.files = list.files.filter(function(obj) {
    return removed.indexOf(obj.name) == -1;
  });

  delete list.structured;

  // produce the file
  var packageTasks = [];

  packageTasks.push(function(out, done) {
    // top level boundary
    out.write('(function(){');
    // the require() implementation
    if(options.require !== false) {
      out.write(fs.readFileSync(__dirname + '/resources/require.min.js'));
    } else {
      out.write(fs.readFileSync(__dirname + '/resources/require.fallthrough.js'));
    }
    // the registry definition
    out.write('\nrequire.m = [];\n');
    done();
  });

  // for each module, write `require.m[n] = { normalizedName: .. code .. , };`

  list.packages.forEach(function(packageObj, current) {

    // package header
    packageTasks.push(function header(out, done) {
      // out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');
      log.info('Processing package:', (packageObj.name ? packageObj.name : 'root'));
      out.write('require.m['+current+'] = {\n');
      // store replaced and remapped for all packages
      out.write(replaced);
      out.write(remapped);
      done();
    });
    // stream each file in serial order
    packageObj.files.forEach(function(item, innerCurrent) {
      var fullpath = item.name,
          relname = path.relative(packageObj.basepath, item.name);

      // all dependencies already have a basepath and the names are
      // already relative to it, but this is not true for the main package
      if(current === 0 && relname.substr(0, basepath.length) == basepath) {
        relname = relname.substr(basepath.length);
      }

      if(!fs.existsSync(fullpath)) {
        throw new Error('File not found: '+fullpath+' Basepath = "' +
          packageObj.basepath+'", filename="' + relname +'"');
      }

      // add the first task
      packageTasks.push(
        function(out, done) {
          out.write(JSON.stringify(relname) + ': ');
          done();
        });


      // console.log('getTasks', item, commands, getFileTasks(item, packageObj, commands));

      var flow = new Flow(getFileTasks(item, packageObj, commands)).input(fs.createReadStream(fullpath));

      // these are used to disambiguate cached results
      flow.inputFilePath = fullpath;
      flow.taskHash = optsHash;

      flow.once('hit', function() {
        cacheHits.push(fullpath);
        // console.log('Cache hit:', fullpath);
      });

      flow.once('miss', function() {
        // console.log('Cache miss:', fullpath);
        log.info('  Processing file', fullpath);
      });

      packageTasks.push(
        flow
      );

      packageTasks.push(
        function(out, done) {
          out.write(',\n');
          done();
        });
    });

    // package footer
    packageTasks.push(function(out, done) {

      // store dependency references
      Object.keys(packageObj.dependenciesById).forEach(function(name) {
        var uid = packageObj.dependenciesById[name],
            index;

        // find the package in the (possibly altered) packages list by unique id
        list.packages.some(function(item, itemIndex) {
          var match = (item.uid == uid);
          if(match) {
            index = itemIndex;
          }
          return match;
        });

        // require.m[n]['foo'] = { c: 1, m: 'lib/index.js' }
        out.write(
          JSON.stringify(name) + ': ' + JSON.stringify({
            c: index,
            m: list.packages[index].main
          }));
        out.write(',\n');
        done();
      });

      out.write('};\n');
      done();
    });
  });

  packageTasks.push(function(out, done) {
    // requireJS export
    //
    // Note that at least RequireJS 2.1.4 is quite stupid.
    // If, after a define('foo', 'bar') you do a synchronous require:
    //    require('foo');
    // it'll complain about the module not being loaded for context.
    // However, it picks up the change if you do:
    //    require(['foo'], function(foo){ console.log(foo); });
    //
    if(options['amd']) {
      out.write('if (typeof define === "function" && define.amd) {');
      out.write('define('+JSON.stringify(exportVariableName)+', function() { return require(\'' +  packageRootFileName + '\'); });\n');
      out.write('}\n');
    }
    // export the package root into `window`
    out.write(exportVariableName + ' = require(\'' +  packageRootFileName + '\');\n');

    // options: global-require: export the require() implementation into the global space
    if(options['global-require']) {
      out.write('window.require = require.relative("", 0);');
    }

    // finally, close the package file
    out.write('}());');

    delete list.structured;

    if(options.report) {
      if(cacheHits.length > 0) {
        console.log('Cache hits:', cacheHits.length, '/', list.files.length, 'files');
        // exclude cached files
        list.packages.forEach(function(pack, index) {
          list.packages[index].files = list.packages[index].files.filter(function(item) {
            return cacheHits.indexOf(item.name) == -1;
          });
        });
      }
      require('./report-package.js')(list);
    }

    done();
  });

  runner.parallel(packageTasks, {
      cacheEnabled: (options.cache ? true : false),
      cachePath: '/home/m/tmp/gluecache',
      cacheMethod: 'stat',
      output: (out ? out : process.stdout),
      limit: 16,
      end: (out !== process.stdout ? true : false), // e.g. no "end" for process.stdout
      onDone: function() {
        onDone && onDone();
      }
  });

};
