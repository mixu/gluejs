var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    runner = require('../../../lib/runner/commonjs2/index.js');

exports['package generator tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();
    this.cache = Cache.instance({
        method: 'stat',
        path: require('os').tmpDir() + '/gluejs-' + new Date().getTime()
    });
  },

  'can package a single file': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = true;'
    });

    runner({
      basepath: outDir,
      cache: this.cache,
      list: [
        {
          filename: outDir + '/index.js',
          content: outDir + '/index.js',
          rawDeps: [],
          deps: [],
          renames: []
        }
      ],
      out: file
    }, function(err, result) {
      console.log(fs.readFileSync(outFile).toString());

      done();
    });
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
