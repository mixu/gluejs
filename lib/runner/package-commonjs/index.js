var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    runner = require('../../runner.js'),
    // tasks
    inferPackages = require('../../tree-tasks/infer-packages.js'),
    filterNpm = require('../../tree-tasks/filter-npm.js'),
    filterRegex = require('../../tree-tasks/filter-regex.js'),
    filterPackages = require('../../tree-tasks/filter-packages.js'),
    wrapCommonJs = require('../../file-tasks/wrap-commonjs-web.js');

// this runner concatenates the files to stdout after running wrap-commonjs-web
module.exports = function(tree, options, out, onDone) {
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
      basepath = (options.basepath ? path.normalize(options.basepath) : '');

  // exclude files using the npmjs defaults for file and path exclusions
  filterNpm(tree);
  // exclude files matching specific expressions
  // - because .npmignores often do not cover all the files to exclude
  filterRegex(tree, [
    new RegExp('\/test\/'),
    new RegExp('\/dist\/'),
    new RegExp('test\.js$'),
    new RegExp('\/example\/'),
    new RegExp('\/benchmark\/')
  ]);

  // annotate with file-level tasks
  /*
  annotateWithTask(tree, [
    require('../../file-tasks/wrap-commonjs-web.js')
  ]);
  */

  // run tree level tasks

  // - generate `.packages` from `.files` (by grouping the set of `.files` into distinct dependencies)
  //   ... and infer the package main file
  inferPackages(tree, { main: options.main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(tree);

  // pluck the main file for the first package
  packageRootFileName = tree.packages[0].main;

  // filter out non-JS files
  var removed = [];
  // find the ignore files (applying them in the correct order)
  function traverse(packageObj) {
    packageObj.files = packageObj.files.filter(function(name) {
      var result = (/\.js$/.test(name));
      // also update tree.files
      if(!result) {
        removed.push((packageObj.basepath ? packageObj.basepath : '')  + name);
      }
      return result;
    });
  }

  tree.packages.forEach(traverse);

  // update files
  tree.files = tree.files.filter(function(obj) {
    return removed.indexOf(obj.name) == -1;
  });

  delete tree.structured;

  // produce the file
  console.log(util.inspect(tree, false, 20, true));

  require('./report-package.js')(tree);


  // top level boundary
  out.write('(function(){');
  // the require() implementation
  out.write(fs.readFileSync(__dirname + '/resources/require.new.min.js'));
  // the registry definition
  out.write('\nrequire.m = [];\n');

  // for each module, write `require.m[n] = { normalizedName: .. code .. , };`
  var current = 0;

  function next() {
    var packageObj = tree.packages[current],
        innerCurrent = 0;

    out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');

    out.write('require.m['+current+'] = { \n');

    function inner() {
      var fullpath = (packageObj.basepath ? packageObj.basepath : '') + '/' +
                      packageObj.files[innerCurrent];

      // if there are no items in the files array
      if(innerCurrent == packageObj.files.length) {
        out.write('};\n');
        if(current == tree.packages.length){
          return onEnd();
        } else {
          return next();
        }
      }


      // all dependencies already have a basepath and the names are
      // already relative to it, but this is not true for the main package
      var relname = packageObj.files[innerCurrent];
      if(current == 0 && relname.substr(0, basepath.length) == basepath) {
        relname = relname.substr(basepath.length);
      }

      out.write(JSON.stringify(relname) + ': ');

      if(!fs.existsSync(fullpath)) {
        throw new Error('File not found: '+fullpath+' Basepath = "' +
          packageObj.basepath+'", filename="' + packageObj.files[innerCurrent]+'"');
      }


      var last = runner({ stdout: fs.createReadStream(fullpath) }, [ wrapCommonJs ]);
      last.stdout.on('end', function() {
        if(innerCurrent < packageObj.files.length) {
          out.write(',\n');
        }

        if(innerCurrent == packageObj.files.length) {
          // store dependencies
          if(Object.keys(packageObj.dependencies).length > 0) {
            out.write(',');
            Object.keys(packageObj.dependencies).forEach(function(name) {
              var index = packageObj.dependencies[name];
              // require.m[n]['foo'] = { c: 1, m: 'lib/index.js' }
              out.write(
                JSON.stringify(name) + ': ' + JSON.stringify({
                  c: index,
                  m: tree.packages[index].main
                }) + ',\n');
            });
          }

          out.write('};\n');

          if(current == tree.packages.length){
            return onEnd();
          } else {
            return next();
          }
        }

        inner();
      });

      // need to do this here so we can catch the second-to-last stream's "end" event;
      last.stdout.pipe(out, { end: false });

      innerCurrent++;
    }

    current++;
    inner();
  }

  next();

  function onEnd() {
    // export the package root into `window`
    out.write(exportVariableName + ' = require(\'' +  packageRootFileName + '\');\n');
    // finally, close the package file
    out.write('}());');

    delete tree.structured;

    onDone && onDone();
//    console.log(util.inspect(tree, false, 20, true));
  }
};
