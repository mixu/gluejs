var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Glue = require('gluejs');

module.exports = {
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

  'can package additional files (and first include file is assumed to be main)': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'first.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = "Second";'
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result,  'Second');
      done();
    });

    new Glue()
    .include(outDir + '/first.js')
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .render(file);
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
  }
};

