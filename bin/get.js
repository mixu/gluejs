#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    detective = require('detective'),
    resolve = require('resolve');

var List = require('minitask').list;

var list = new List();
list.find(function(filepath, stat, onDone) {
  // only .js files
  if(path.extname(filepath) != '.js') {
    return onDone(null, []);
  }

  var basepath = path.dirname(filepath),
      deps;
  try {
    deps = detective(fs.readFileSync(filepath).toString());
  } catch(e) {
    // console.log('parse error: ', fullpath, e);
    return onDone(null, []);
  }

  if(!deps || deps.length === 0) {
    return onDone(null, []);
  }

  return onDone(null, deps.filter(function(dep) {
      return !resolve.isCore(dep);
    }).map(function(dep) {
      var normalized;

      try {
        normalized = resolve.sync(dep, { basedir: basepath });
      } catch(e) {
        // console.log('resolve error: ', e, dep, basepath);
        return undefined;
      }
      if(normalized.match(/.*\/node_modules\/.*/)) {
        return undefined;
      }

      return path.normalize(normalized);
    }).filter(Boolean));
});

var main = process.argv[2],
    basepath = path.dirname(main);

console.log('Reading file from first argument: ' + main);

list.add(main);
list.exec(function(err, files) {
  console.log('done!');

  console.log(files.map(function(file) { return file.name; }));

  /*
  var inferPackages = require('../lib/list-tasks/infer-packages.js'),
      filterPackages = require('../lib/list-tasks/filter-packages.js');

  inferPackages(list, { main: main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  console.log(util.inspect(list.packages, false, 1, true));
  */
});
