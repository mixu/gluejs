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
    var result = g.include(__dirname+'/fixtures/rendertest/simple.js').resolve();
    assert.equal(result.length, 1);
    assert.equal(result[0], __dirname+'/fixtures/rendertest/simple.js');
    done();

  },
  'can include a directory': function(done) {
    var g = this.group;
    var result = g.include(__dirname+'/fixtures/rendertest/').resolve();
    assert.equal(result.length, 2);
    assert.equal(result[0], __dirname+'/fixtures/rendertest/has_dependency.js');
    assert.equal(result[1], __dirname+'/fixtures/rendertest/simple.js');
    done();
  },

  'can exclude a path by regexp': function(done) {
    var g = this.group;
    var result = g.include(__dirname+'/fixtures/rendertest/')
      .exclude(new RegExp('.*simple\.js$'))
      .resolve();
    assert.equal(result.length, 1);
    assert.equal(result[0], __dirname+'/fixtures/rendertest/has_dependency.js');
    done();
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
