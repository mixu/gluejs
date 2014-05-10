var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    Glue = require('gluejs');

module.exports = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();

    Minilog.suggest.defaultResult = false;
    Minilog.suggest.clear().allow(/.*/, 'info');
    this.cachePath = require('os').tmpDir() + '/gluejs-' + new Date().getTime();
  },

  'it works': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "Index";'
    });


    file.once('close', function() {
      console.log(outFile);
      console.log(fs.readFileSync(outFile).toString());

      var result = require(outFile);
      assert.deepEqual(result, "Index");
      done();
    });

    new Glue()
      .include(outDir)
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
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

