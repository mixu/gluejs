#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    detective = require('detective'),
    resolve = require('resolve');

pending = [];

function List() {
  this.files = [];
  this.seen = {};
}

List.prototype.include = function(fullpath, onDone) {
  var self = this,
      completed = 0,
      waiting = 0;
  if(this.seen[fullpath]) {
    if(onDone) {
      onDone();
    }
    return;
  }
  this.seen[fullpath] = true;

  var stat = fs.statSync(fullpath);
  // console.log(fullpath);
  this.files.push({ name: fullpath, stat: stat });

  // do not parse/process non-js files
  if (path.extname(fullpath) != '.js') {
    if(onDone) {
      onDone();
    }
    return;
  }


  var basepath = path.dirname(fullpath),
      deps;

  try {
    deps = detective(fs.readFileSync(fullpath).toString());
  } catch(e) {
    console.log('parse error: ', fullpath, e);
    if(onDone) {
      onDone();
    }
    return;
  }

  if(deps.length === 0) {
    if(onDone) {
      onDone();
    }
    return;
  }


  waiting = deps.length;
  function isDone() {
    completed++;
    if(completed == waiting && onDone) {
      onDone();
    }
  }

  deps.forEach(function(dep) {
    var normalized;

    try {
      normalized = resolve.sync(dep, { basedir: basepath });
    } catch(e) {
      console.log('resolve error: ', e);
      return isDone();
    }

    // exclude core
    if(resolve.isCore(normalized) || self.seen[normalized]) {
      return isDone();
    }
    // avoid call stack issues
    process.nextTick(function() {
      self.include(normalized, isDone);
    });
  });
};

var list = new List(),
    main = process.argv[2],
    basepath = path.dirname(main);

console.log('Reading file from first argument: ' + main);
list.include(main, function() {
  console.log('done!');

  // console.log(list.files);

  var inferPackages = require('../lib/list-tasks/infer-packages.js'),
      filterPackages = require('../lib/list-tasks/filter-packages.js');

  inferPackages(list, { main: main, basepath: basepath });
  // - for each package, apply excludes (package.json.files, .npmignore, .gitignore)
  filterPackages(list);

  console.log(util.inspect(list.packages, false, 1, true));
});

