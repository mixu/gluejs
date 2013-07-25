var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    runner = require('minitask').runner,
    cache = require('minitask').cache,
    // tasks
    spawn = require('../../file-tasks/spawn.js'),
    streamSize = require('../../file-tasks/stream-size.js'),
    annotateStat = require('../../list-tasks/annotate-stat.js'),
    inferPackages = require('../../list-tasks/infer-packages.js'),
    filterNpm = require('../../list-tasks/filter-npm.js'),
    filterRegex = require('../../list-tasks/filter-regex.js'),
    filterPackages = require('../../list-tasks/filter-packages.js'),
    wrapCommonJs = require('../../file-tasks/wrap-commonjs-web.js'),
    wrapJson = require('../../file-tasks/wrap-json-web.js'),

    log = require('minilog')('package-commonjs');

// this runner concatenates the files to stdout after running wrap-commonjs-web
module.exports = function(list, options, out, onDone) {
  if(!options) {
    options = {};
  }
  if(!out) {
    out = process.stdout;
  }

  // unpack options
  var exportVariableName = options['export'] || 'foo',
      packageRootFileName,
      // normalize basepath
      basepath = (options.basepath ? path.normalize(options.basepath) : ''),
      // replaced modules (e.g. jquery => window.jquery)
      replaced = options.replaced || {},
      // cache hit filepaths
      cacheHits = [];

  // console.log(util.inspect(list.files.map(function(item) { return item.name; }), false, 20, true));

  // exclude files using the npmjs defaults for file and path exclusions
  filterNpm(list);
  // exclude files matching specific expressions
  // - because .npmignores often do not cover all the files to exclude
  var excludeList = [
//    new RegExp('\/test\/'),
    new RegExp('\/dist\/'),
//    new RegExp('test\.js$'),
    new RegExp('\/example\/'),
    new RegExp('\/benchmark\/'),
    new RegExp('[-.]min.js$')
  ];

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

  // annotate with file-level tasks
  /*
  annotateWithTask(list, [
    require('../../file-tasks/wrap-commonjs-web.js')
  ]);
  */

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
  // separate package! Need a better test for this in the long run...c
  if(list.packages[0].files.length == 0) {
    list.packages.shift();
  }
  if(list.packages.length == 0) {
    throw new Error('No files were included in the build. Check your `.include()` call paths.');
  }

  // pluck the main file for the first package
  packageRootFileName = list.packages[0].main;

  // filter out non-JS files
  var removed = [];
  // find the ignore files (applying them in the correct order)
  function traverse(packageObj) {
    packageObj.files = packageObj.files.filter(function(item) {
      var result = (/(\.js|\.json)$/.test(item.name));
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
  // console.log(util.inspect(list.packages, false, 20, true));

  // top level boundary
  out.write('(function(){');
  // the require() implementation
  out.write(fs.readFileSync(__dirname + '/resources/require.min.js'));
  // the registry definition
  out.write('\nrequire.m = [];\n');

  // for each module, write `require.m[n] = { normalizedName: .. code .. , };`
  var tasks = [];

  list.packages.forEach(function(packageObj, current) {
    // package header
    tasks.push(function(done) {
      // out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');
      log.info('Processing package:', (packageObj.name ? packageObj.name : 'root'));

      out.write('require.m['+current+'] = {\n');
      done();
    });
    // to generate commas, need to know how many items there are in total. The last
    // item doesn't get a comma at the end
    var total = (packageObj.files.length + Object.keys(packageObj.dependenciesById).length),
        linecount = 0;

    function eol() {
      if(++linecount < total) {
        out.write(',\n');
      }
    }

    // store replaced for all packages
//    if(current == 0) {
      total += Object.keys(replaced).length;
      Object.keys(replaced).forEach(function(key) {
        tasks.push(function(done) {
          out.write(JSON.stringify(key) + ': '+ '{ exports: ' + replaced[key] + ' }');
          eol();
          done();
        });
      });
//    }

    // stream each file in serial order
    packageObj.files.forEach(function(item, innerCurrent) {
      var fullpath = item.name,
          relname = path.relative(packageObj.basepath, item.name);

      // all dependencies already have a basepath and the names are
      // already relative to it, but this is not true for the main package
      if(current == 0 && relname.substr(0, basepath.length) == basepath) {
        relname = relname.substr(basepath.length);
      }

      if(!fs.existsSync(fullpath)) {
        throw new Error('File not found: '+fullpath+' Basepath = "' +
          packageObj.basepath+'", filename="' + relname +'"');
      }

      tasks.push(function(done) {
        out.write(JSON.stringify(relname) + ': ');

        var last, tasks = [ ];
        switch(path.extname(item.name)) {
          case '.js':
            tasks.push(function() {
              return wrapCommonJs({
                'source-url': options['source-url'],
                'name': (packageObj.name ? exportVariableName+'/' + packageObj.name + '/' : exportVariableName+'/')  + relname
              });
            });
            break;
          case '.json':
            tasks.push(function() {
              return wrapJson({ });
            });
            break;
        }
        // if a external command is applied, shift it onto the stack
        if(options.command) {
          if(path.extname(item.name) == '.js') {
            tasks.unshift(function() {
                return spawn({
                name: item.name, // full path
                task: options.command
              });
            });
          }
          // if we are reporting, add the stream size capture task at the end
          // so we can report on results (e.g. of minification)
          if(options.report) {
            tasks.push(streamSize({
              onDone: function(size) {
                packageObj.files[innerCurrent].sizeAfter = size;
              }
            }));
          }
        }

        if(options['cache']) {
          last = cache({
            filepath: fullpath,
            cachepath: options['cache'],
            stat: item.stat,
            options: options,
            onHit: function() {
              cacheHits.push(fullpath);
            },
            onMiss: function() {
              log.info('  Processing file', fullpath);
            }
          }, tasks, function() {
            eol();
            done();
          });
        } else {
          log.info('  Processing file', fullpath);
          last = runner({
            stdout: fs.createReadStream(fullpath)
          }, tasks, function() {
            eol();
            done();
          });
        }
        // need to do this here so we can catch the second-to-last stream's "end" event;
        last.stdout.pipe(out, { end: false });
      });
    });

    // store dependency references
    Object.keys(packageObj.dependenciesById).forEach(function(name) {
      tasks.push(function(done) {
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
        eol();
        done();
      });
    });

    // package footer
    tasks.push(function(done) {
      out.write('};\n');
      done();
    });
  });

  /*
  var running = 0,
      limit = 16;

  function parallel() {
    while(running < limit && tasks.length > 0) {
      var task = tasks.shift();
      task(function() {
        running--;
        if(tasks.length > 0) {
          parallel();
        } else if(running == 0) {
          onEnd();
        }
      });
      running++;
    }
  }
  parallel();
  */

  function series(task) {
    if(task) {
      task(function(result) {
        return series(tasks.shift());
      });
    } else {
      return onEnd();
    }
  }
  series(tasks.shift());

  function onEnd() {
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
      out.write('window.require = require;');
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

    onDone && onDone();
//    console.log(util.inspect(list, false, 20, true));
  }
};
