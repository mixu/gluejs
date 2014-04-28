var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    Glue = require('gluejs');

exports['package generator tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();
    this.cachePath = require('os').tmpDir() + '/gluejs-' + new Date().getTime();
  },

  'can package a single file': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result, "Index");
      done();
    });

    new Glue()
      .include(outDir)
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },

  'can package additional files': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = "Second";'
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result,  'Second');
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .render(file);
  },

  'can specify a single string --command': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result,  'BAR');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('command', 'bash -c "echo \'module.exports = \"BAR\";\'"')
      .set('umd', true)
      .render(file);
  },

  'can specify an array of --commands': function() {

  },

  'can specify a single string --transform': function() {

  },

  'can specify an array of string transforms': function() {

  },

  'can specify a --transform function': function() {

  },

  'can build a basic module with an external dependency and uglify': function() {

  },

  'can --exclude files from the build': function() {

  },

  'can --rename a module': function() {
    // to a different file
    // to an external
  },

  'can add --source-url\'s': function() {

  },

  'can --global-require to export the require implementation': function() {

  },

  'can write a --umd bundle': function() {

  },

  'can build with --no-parse': function() {

  },

  'can build a JSON file': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./foo.json");\n',
      'foo.json': '{ "foo": "bar" }\n'
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result,  { foo: "bar" });
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },

  'can apply multiple transformations': function() {

  },

  'can fetch a build using the Express middleware': function() {

  },

  'can avoid expensive operations using an etag': function() {

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

