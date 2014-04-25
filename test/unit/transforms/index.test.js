var assert = require('assert'),
    util = require('util');

var Minilog = require('minilog');
var FixtureGen = require('../../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    runner = require('../../../lib/runner/transforms/index.js');

exports['runQueue tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();
    this.cache = Cache.instance({
        method: 'stat',
        path: require('os').tmpDir() + '/gluejs-' + new Date().getTime()
    });

  },

  'can run a single file': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = true;'
    });

    runner({
      include: [ outDir + '/index.js' ],
      cache: this.cache
    }, function(err, results) {
      assert.ok(!err);
      assert.equal(results.length, 1);
      assert.deepEqual(results[0], {
        filename: outDir + '/index.js',
        content: outDir + '/index.js',
        rawDeps: [],
        deps: [],
        renames: []
      });
      done();
    });
  },

  'can resolve additional files': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = true;'
    });

    runner({
      include: [ outDir + '/index.js' ],
      cache: this.cache
    }, function(err, results) {
      assert.ok(!err);
      // console.log(results);
      assert.equal(results.length, 2);
      assert.deepEqual(results[0], {
        filename: outDir + '/index.js',
        content: outDir + '/index.js',
        rawDeps: [ './second.js' ],
        deps: [ outDir + '/second.js' ],
        renames: []
      });
      assert.deepEqual(results[1], {
        filename: outDir + '/second.js',
        content: outDir + '/second.js',
        rawDeps: [ ],
        deps: [ ],
        renames: []
      });
      done();
    });
  },

  'can resolve external deps': function(done) {
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/package.json': '{ "main": "main.js" }',
      'node_modules/foo.js': 'module.exports = true;',
      'node_modules/foo/lib/sub.js': 'module.exports = true;'
    });
    done();
  },

  'can resolve core deps': function(done) {
    done();
  },

  'can resolve sub-sub dependencies': function(done) {
    var spec = {
      'index.js': 'module.exports = true;',
      'node_modules/aa/index.js': 'module.exports = true;',
      'node_modules/aa/node_modules/bb.js': 'module.exports = true;',
      'node_modules/aa/node_modules/cc/differentfile.js': 'module.exports = true;',
      'node_modules/aa/node_modules/cc/package.json': '{ "main": "differentfile.js" }'
    }
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
      };
  },

  'can specify a single string --command': function() {

  },

  'can specify an array of --commands': function() {

  },

  'can specify a single string --transform': function() {

  },

  'can specify an array of string transforms': function() {

  },

  'can specify a --transform function': function() {

  },

  'running the same operation twice should hit the cache': function() {

  },

  'can apply user exclusions': function() {

  },

  'cannot add files which match the npm filter': function() {

  }


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
