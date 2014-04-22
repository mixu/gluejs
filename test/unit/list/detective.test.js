var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    FixtureGen = require('../../lib/fixture-gen.js');

var DetectiveList = require('../../../lib/list/detective.js');

function alpha(a, b) {
  return a.name.localeCompare(b.name);
}

exports['detectiveList tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
  },

  beforeEach: function() {
    var outDir = this.fixture.dirname();
    this.list = new DetectiveList({
      'cache-path': outDir,
      'cache-method': 'stat',
      'cache-hash': new Date().getTime().toString()
    });
  },

  'can add and resolve a single file': function(done) {
    var outDir = this.fixture.dir({
      'main.js': 'module.exports = require("./dep");',
      'dep.js': 'module.exports = "foo";'
    });

    this.list.add(outDir + '/main.js');
    this.list.exec(function(err, files) {
      assert.ok(!err);
      files.sort(alpha);
      assert.equal(files.length, 2);
      assert.equal(files[0].name, outDir + '/dep.js');
      assert.equal(files[1].name, outDir + '/main.js');
      done();
    });
  },

  'can add and resolve multiple files': function(done) {
    var outDir = this.fixture.dir({
      'one.js': 'module.exports = require("./dep.js");',
      'two.js': 'module.exports = require("./dep");',
      'dep.js': 'module.exports = "foo";'
    });

    this.list.add(outDir + '/one.js');
    this.list.add(outDir + '/two.js');
    this.list.exec(function(err, files) {
      assert.ok(!err);
      assert.equal(files.length, 3);
      files.sort(alpha);
      assert.equal(files[0].name, outDir + '/dep.js');
      assert.equal(files[1].name, outDir + '/one.js');
      assert.equal(files[2].name, outDir + '/two.js');
      done();
    });
  },

  'can add and resolve a folder': function(done) {
    var outDir = this.fixture.dir({
      'one.js': 'module.exports = "bar";',
      'two.js': 'module.exports = require("./sub/dep");',
      'sub/dep.js': 'module.exports = "foo";'
    });
    this.list.add(outDir);
    this.list.exec(function(err, files) {
      assert.ok(!err);
      assert.equal(files.length, 3);
      files.sort(alpha);
      assert.equal(files[0].name, outDir + '/one.js');
      assert.equal(files[1].name, outDir + '/sub/dep.js');
      assert.equal(files[2].name, outDir + '/two.js');
      done();
    });
  },

  'if the folder is empty, iterate folders until you reach a non-empty folder': function(done) {
    var outDir = this.fixture.dir({
      'foo/bar/baz/main.js': 'module.exports = require("./abc/dep");',
      'foo/bar/baz/abc/dep.js': 'module.exports = "foo";'
    });

    this.list.add(outDir);
    this.list.exec(function(err, files) {
      assert.ok(!err);
      files.sort(alpha);
      assert.equal(files.length, 2);
      assert.equal(files[0].name, outDir + '/foo/bar/baz/abc/dep.js');
      assert.equal(files[1].name, outDir + '/foo/bar/baz/main.js');
      done();
    });

  },

  'can resolve modules that are peers': function(done) {
    var outDir = this.fixture.dir({
      'one.js': 'module.exports = require("backbone");',
      'two.js': 'module.exports = require("underscore");',
      'node_modules/backbone.js': 'require("underscore"); module.exports = "backbone";',
      'node_modules/underscore.js': 'module.exports = "underscore";',
    });
    this.list.add(outDir + '/one.js');
    this.list.add(outDir + '/two.js');
    this.list.exec(function(err, files) {
      assert.ok(!err);
      assert.equal(files.length, 4);
      files.sort(alpha);
      assert.equal(files[0].name, outDir + '/node_modules/backbone.js');
      assert.equal(files[1].name, outDir + '/node_modules/underscore.js');
      assert.equal(files[2].name, outDir + '/one.js');
      assert.equal(files[3].name, outDir + '/two.js');
      done();
    });
  },

  'can resolve modules that are in the node_modules folder of the parent': function() {
    var outDir = this.fixture.dir({
      'foo/bar/one.js': 'module.exports = require("backbone");',
      'foo/bar/node_modules/underscore.js': 'module.exports = "underscore";',
      'foo/node_modules/other.js': 'module.exports = "other";',
      'node_modules/backbone.js': 'require("underscore"); module.exports = "backbone";',
    });
    this.list.add(outDir + '/foo/bar/one.js');
    this.list.exec(function(err, files) {
      assert.ok(!err);
      assert.equal(files.length, 2);
      files.sort(alpha);
      assert.equal(files[0].name, outDir + '/foo/bar/one.js');
      assert.equal(files[1].name, outDir + '/node_modules/backbone.js');
      done();
    });
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [
    '--colors', '--ui', 'exports', '--reporter', 'spec', __filename
  ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

