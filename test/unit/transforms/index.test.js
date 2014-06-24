var assert = require('assert'),
    util = require('util');

var Minilog = require('minilog');
var FixtureGen = require('../../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    runner = require('transform-runner');

exports['runQueue tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();
    this.cache = Cache.instance({
        method: 'stat',
        path: require('os').tmpDir() + '/gluejs-' + new Date().getTime()
    });

  },

  'can add and resolve a single file': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = true;'
    });

    var r = runner({
      include: [ outDir + '/index.js' ],
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });

    r.exec(function(err, results) {
      assert.ok(!err);
      assert.equal(results.length, 1);
      assert.deepEqual(results[0], {
        filename: outDir + '/index.js',
        content: outDir + '/index.js',
        deps: {},
        renames: []
      });
      done();
    });
  },

  'can add and resolve additional files': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = true;'
    });

    var r = runner({
      include: [ outDir + '/index.js' ],
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });
    r.exec(function(err, results) {
      assert.ok(!err);
      // console.log(results);
      assert.equal(results.length, 2);
      assert.deepEqual(results[0], {
        filename: outDir + '/index.js',
        content: outDir + '/index.js',
        deps: { './second.js': outDir + '/second.js' },
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/second.js',
        content: outDir + '/second.js',
        deps: {},
        renames: []
      });
      done();
    });
  },

  'can add and resolve a folder': function(done) {
    var outDir = this.fixture.dir({
      'one.js': 'module.exports = "bar";',
      'two.js': 'module.exports = require("./sub/dep");',
      'sub/dep.js': 'module.exports = "foo";'
    });

    var r = runner({
      include: [ outDir ],
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });
    r.exec(function(err, results) {
      assert.ok(!err);
      assert.equal(results.length, 3);
      // console.log(results);
      assert.deepEqual(results[0], {
        filename: outDir + '/one.js',
        content: outDir + '/one.js',
        deps: {},
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/sub/dep.js',
        content: outDir + '/sub/dep.js',
        deps: {},
        renames: []
      });
      assert.deepEqual(results[2], {
        filename: outDir + '/two.js',
        content: outDir + '/two.js',
        deps: { './sub/dep': outDir + '/sub/dep.js' },
        renames: []
      });
      done();
    });
  },

  'if the folder is empty, iterate folders until you reach a non-empty folder': function(done) {
    var outDir = this.fixture.dir({
      'foo/bar/baz/main.js': 'module.exports = "first";',
      'foo/bar/baz/abc/dep.js': 'module.exports = "foo";'
    });

    var r = runner({
      include: outDir,
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });
    r.exec(function(err, results) {
      assert.ok(!err);
      // console.log(results);
      assert.equal(results.length, 2);
      assert.deepEqual(results[0], {
        filename: outDir + '/foo/bar/baz/abc/dep.js',
        content: outDir + '/foo/bar/baz/abc/dep.js',
        deps: {},
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/foo/bar/baz/main.js',
        content: outDir + '/foo/bar/baz/main.js',
        deps: {},
        renames: []
      });
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

    var r = runner({
      include: [
        outDir + '/one.js',
        outDir + '/two.js'
      ],
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });
    r.exec(function(err, results) {
      assert.ok(!err);
      assert.equal(results.length, 4);
      // console.log(results);
      assert.deepEqual(results[0],  {
        filename: outDir + '/node_modules/backbone.js',
        content: outDir + '/node_modules/backbone.js',
        deps: { 'underscore': outDir + '/node_modules/underscore.js' },
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/node_modules/underscore.js',
        content: outDir + '/node_modules/underscore.js',
        deps: {},
        renames: []
      });
      assert.deepEqual(results[2], {
        filename: outDir + '/one.js',
        content: outDir + '/one.js',
        deps: { 'backbone': outDir + '/node_modules/backbone.js' },
        renames: []
      });
      assert.deepEqual(results[3], {
        filename: outDir + '/two.js',
        content: outDir + '/two.js',
        deps: { 'underscore': outDir + '/node_modules/underscore.js' },
        renames: []
      });
      done();
    });
  },

  'can resolve modules that are in the node_modules folder of the parent': function(done) {
    var outDir = this.fixture.dir({
      'foo/bar/one.js': 'module.exports = require("backbone");',
      'foo/bar/node_modules/backbone.js': 'require("underscore"); module.exports = "backbone";',
      'foo/node_modules/other.js': 'module.exports = "other";',
      'node_modules/underscore.js': 'module.exports = "underscore";',
    });

    var r = runner({
      include: outDir + '/foo/bar/one.js',
      // cache: this.cache,
      log: require('minilog')('runner'),
      jobs: 1
    });
    r.exec(function(err, results) {
      assert.ok(!err);
      assert.equal(results.length, 3);
      // console.log(results);
      assert.deepEqual(results[0], {
        filename: outDir + '/foo/bar/node_modules/backbone.js',
        content: outDir + '/foo/bar/node_modules/backbone.js',
        deps: { 'underscore': outDir + '/node_modules/underscore.js' },
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/foo/bar/one.js',
        content: outDir + '/foo/bar/one.js',
        deps: { 'backbone': outDir + '/foo/bar/node_modules/backbone.js' },
        renames: []
      });
      assert.deepEqual(results[2], {
        filename: outDir + '/node_modules/underscore.js',
        content: outDir + '/node_modules/underscore.js',
        deps: {},
        renames: []
      });
      done();
    });
  },

  'can resolve external deps': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/package.json': '{ "main": "main.js" }',
      'node_modules/foo/main.js': 'module.exports = require("./lib/sub");',
      'node_modules/foo/lib/sub.js': 'module.exports = true;'
    });
    var r = runner({
        include: [ outDir + '/index.js' ],
        // cache: this.cache,
        log: require('minilog')('runner'),
        jobs: 1
      });
    r.exec(function(err, results) {
        assert.ok(!err);
        // console.log(results);
        assert.equal(results.length, 3);
        assert.deepEqual(results, [
        {
          filename: outDir + '/index.js',
          content: outDir + '/index.js',
          deps: { 'foo': outDir + '/node_modules/foo/main.js' },
          renames: [] },
        { filename: outDir + '/node_modules/foo/lib/sub.js',
          content: outDir + '/node_modules/foo/lib/sub.js',
          deps: {},
          renames: [] },
        { filename: outDir + '/node_modules/foo/main.js',
          content: outDir + '/node_modules/foo/main.js',
          deps: { './lib/sub': outDir + '/node_modules/foo/lib/sub.js' },
          renames: [] }
        ]);

        done();
    });
  },

  'can resolve core deps': function(done) {
    done();
  },

  'can resolve sub-sub dependencies': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("aa");',
      'node_modules/aa/index.js': 'module.exports = require("bb");',
      'node_modules/aa/node_modules/bb.js': 'module.exports = require("cc");',
      'node_modules/aa/node_modules/cc/differentfile.js': 'module.exports = "Hello from C";',
      'node_modules/aa/node_modules/cc/package.json': '{ "main": "differentfile.js" }'
    });
    var r = runner({
        include: [ outDir + '/index.js' ],
        // cache: this.cache,
        jobs: 1
      });

    r.exec(function(err, results) {
        assert.ok(!err);
        // console.log(results);
        assert.equal(results.length, 4);
        assert.deepEqual(results, [
           { filename: outDir + '/index.js',
              content: outDir + '/index.js',
              deps: { 'aa': outDir + '/node_modules/aa/index.js' },
              renames: [] },
            { filename: outDir + '/node_modules/aa/index.js',
              content: outDir + '/node_modules/aa/index.js',
              deps: { 'bb': outDir + '/node_modules/aa/node_modules/bb.js' },
              renames: [] },
            { filename: outDir + '/node_modules/aa/node_modules/bb.js',
              content: outDir + '/node_modules/aa/node_modules/bb.js',
              deps: { 'cc': outDir + '/node_modules/aa/node_modules/cc/differentfile.js' },
              renames: [] },
            { filename: outDir + '/node_modules/aa/node_modules/cc/differentfile.js',
              content: outDir + '/node_modules/aa/node_modules/cc/differentfile.js',
              deps: {},
              renames: [] }
        ]);
        done();
    });
  },

  'when a dependency is not found': function() {

  },

  'when a external dependency is not found': function() {
    var spec = {
      'a/index.js': 'module.exports = true;',
      'a/package.json': JSON.stringify({
        main: 'index.js',
        dependencies: {
          b: '*',
          d: '1.x' // this dep only exists in the package.json file
        }
      }),
      'a/node_modules/b/url.js': 'module.exports = true;',
      'a/node_modules/b/package.json': JSON.stringify({
        main: 'url.js',
        dependencies: {
          c: '*'
        }
      })
    };
  },

  'running the same operation twice should hit the cache': function() {

  },

  'can apply user exclusions': function() {

  },

  'cannot add files which match the npm filter': function() {

  },

  'can use --no-externals': function() {

  },

  'can use --only-externals': function() {

  },

  'can --ignore a file': function() {

  },

  'can --ignore-external': function() {

  },

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
