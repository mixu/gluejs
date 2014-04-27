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

  'can build a JSON file': function() {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var inDir = this.fixture.dir({
      'index.js': 'module.exports = require("./foo.json");\n',
      'foo.json': '{ "foo": "bar" }\n'
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result,  { foo: "bar" });
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./')
      .set('cache', false)
      .export('module.exports')
      .render(file);
  },

  'can apply multiple transformations': function() {

  },

  'can fetch a build using the Express middleware': function() {

  },

  'can avoid expensive operations using an etag': function() {

  }

};
