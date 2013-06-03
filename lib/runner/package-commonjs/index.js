var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    runner = require('minitask').runner,
    // tasks
    annotateStat = require('../../list-tasks/annotate-stat.js')
    inferPackages = require('../../list-tasks/infer-packages.js'),
    filterNpm = require('../../list-tasks/filter-npm.js'),
    filterRegex = require('../../list-tasks/filter-regex.js'),
    filterPackages = require('../../list-tasks/filter-packages.js'),
    wrapCommonJs = require('../../file-tasks/wrap-commonjs-web.js');

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
      replaced = options.replaced || {};

  // exclude files using the npmjs defaults for file and path exclusions
  filterNpm(list);
  // exclude files matching specific expressions
  // - because .npmignores often do not cover all the files to exclude
  filterRegex(list, [
//    new RegExp('\/test\/'),
    new RegExp('\/dist\/'),
//    new RegExp('test\.js$'),
    new RegExp('\/example\/'),
    new RegExp('\/benchmark\/'),
    new RegExp('[-.]min.js$')
  ]);

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

  // pluck the main file for the first package
  packageRootFileName = list.packages[0].main;

  // filter out non-JS files
  var removed = [];
  // find the ignore files (applying them in the correct order)
  function traverse(packageObj) {
    packageObj.files = packageObj.files.filter(function(item) {
      var result = (/\.js$/.test(item.name));
      // also update list.files
      if(!result) {
        removed.push(item.name);
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

  require('./report-package.js')(list);

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
      out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');
      out.write('require.m['+current+'] = { \n');
      done();
    });
    // to generate commas, need to know how many items there are in total. The last
    // item doesn't get a comma at the end
    var total = (packageObj.files.length + Object.keys(packageObj.dependencies).length),
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
          relname = path.relative(basepath, item.name);

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

        var last = runner({ stdout: fs.createReadStream(fullpath) }, [ function() {
          return wrapCommonJs({
            'source-url': options['source-url'],
            'name': (packageObj.name ? packageObj.name + '/' : '')  + relname
          });
         } ], function() {
          eol();
          done();
        });
        // need to do this here so we can catch the second-to-last stream's "end" event;
        last.stdout.pipe(out, { end: false });
      });
    });

    // store dependency references
    Object.keys(packageObj.dependencies).forEach(function(name) {
      tasks.push(function(done) {
        var index = packageObj.dependencies[name];
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
    // export the package root into `window`
    out.write(exportVariableName + ' = require(\'' +  packageRootFileName + '\');\n');

    // options: global-require: export the require() implementation into the global space
    if(options['global-require']) {
      out.write('window.require = require;');
    }

    // finally, close the package file
    out.write('}());');

    delete list.structured;

    onDone && onDone();
//    console.log(util.inspect(list, false, 20, true));
  }
};
