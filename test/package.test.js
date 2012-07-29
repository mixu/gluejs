var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),
    Package = require('../lib/package');

exports['given a group'] = {

  beforeEach: function(done) {
    this.p = new Package();
    done();
  },
  // exec and watch should actually emit
  // a series of package objects:
  // e.g.
  //  {
  //    './index.js': ... full path to file
  //    'other': { main: 'foo.js', context: 1 }
  //  },
  //  {
  //    './foo.js'
  //  }
  // The first package is the result of calling exec on the current group
  // The next package is the result of calling exec on the first dependency
  // ( and it will recursively call and return its own dependencies)
  // In fact, groups should not even do any handlers.
  // The handlers are a detail that only really matters to the
  // system that outputs the build. Groups should only deal with files.

/*
  'can add a dependency on a single file package': function(done) {
    var p = this.p;
    p.dependency('foo', __dirname+'/fixtures/expandsingle/');
    console.log('pacakge', util.inspect(p, null, 5, true));

    var result = [];
    p.render(result, function(selfId) {
      console.log('result', util.inspect(result, null, 5, true));

    });

    done();
  },

  'can add a dependency on a package that is a directory (index.js)': function(done) {
    var p = this.p;
    p.dependency('foo', __dirname+'/fixtures/expandindex/');
    console.log('pacakge', util.inspect(p, null, 5, true));

    var result = [];
    p.render(result, function(selfId) {
      console.log('result', util.inspect(result, null, 5, true));

    });

    done();
  },
*/
  'when a dependency has a (sub)dependency, it gets resolved as well': function(done) {
    var p = this.p;
    p.dependency('foo', __dirname+'/fixtures/hassubdependency/');
    console.log('pacakge', util.inspect(p, null, 5, true));

    var result = [];
    p.render(result, function(selfId) {
      console.log('result', util.inspect(result, null, 5, true));

    });

    done();
  },


/*
  'can add a dependency on a package that is a directory (package.json)': function(done) {
    var g = this.group;
    g.dependency('foo', __dirname+'/fixtures/expandpackage/')
     .resolve(function(packageObj) {
      console.log('result', util.inspect(packageObj, null, 5, true));
    });
    done();
  },

*/
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
