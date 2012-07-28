var fs = require('fs'),
    assert = require('assert'),
    Group = require('../lib/group');

exports['given a group'] = {

  beforeEach: function(done) {
    this.group = new Group();
    done();
  },

  'can include a single file': function (done) {
    var g = this.group;
    var result = g.include(__dirname+'/fixtures/lib/simple.js').resolve();
    assert.equal(result.length, 1);
    assert.equal(result[0], __dirname+'/fixtures/lib/simple.js');
    done();

  },
  'can include a directory': function(done) {
    var g = this.group;
    var result = g.include(__dirname+'/fixtures/lib/').resolve();
    assert.equal(result.length, 3);
    assert.equal(result[0], __dirname+'/fixtures/lib/has_dependency.js');
    assert.equal(result[1], __dirname+'/fixtures/lib/simple.js');
    assert.equal(result[2], __dirname+'/fixtures/lib/web.js');
    done();
  },

  'can exclude a path by regexp': function(done) {
    var g = this.group;
    var result = g.include(__dirname+'/fixtures/lib/')
      .exclude(new RegExp('.*simple\.js$'))
      .resolve();
    assert.equal(result.length, 2);
    assert.equal(result[0], __dirname+'/fixtures/lib/has_dependency.js');
    assert.equal(result[1], __dirname+'/fixtures/lib/web.js');
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

  'can add a dependency on a single file package': function(done) {
    done();
  },

  'can add a dependency on a package that is a directory (index.js)': function(done) {
    done();
  },

  'can add a dependency on a package that is a directory (package.json)': function(done) {
    done();
  },




};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
