var assert = require('assert'),
    util = require('util'),
    fs = require('fs'),
    path = require('path');

var Glue = require('gluejs');

module.exports = {

  before: function() {
    var fixture = this.fixture;
    this.cachePath = path.dirname(fixture.filename());
  },

  'running the same build twice will make use of the cache': function(done) {
    var fixture = this.fixture,
        outFile = fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    var self = this;

    var cacheHits = [],
        total = 0;

    file.once('close', function() {
      assert.equal(total, 1);
      assert.equal(cacheHits.length, 0);
      var outFile = fixture.filename({ ext: '.js' }),
            file = fs.createWriteStream(outFile);
      file.once('close', function() {
        // console.log(total, cacheHits);
        assert.equal(total, 2);
        assert.equal(cacheHits.length, 1);
        done();
      });
      build(outDir, file);
    });

    build(outDir, file);

    function build(outDir, file) {
      new Glue()
        .include(outDir)
        .on('file', function() {
          total++;
        })
        .on('hit', function(filename){
          cacheHits.push(filename);
        })
        .set('cache-path', self.cachePath)
        .set('umd', true)
        .render(file);
    }
  },

  'changing options passed into the runner invalidate the cache': function(done) {
    // e.g. --command or no --command
    var fixture = this.fixture,
        outFile = fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    var cacheHits = [],
        total = 0;

    var self = this;

    file.once('close', function() {
      assert.equal(total, 1);
      assert.equal(cacheHits.length, 0);
      var outFile = fixture.filename({ ext: '.js' }),
            file = fs.createWriteStream(outFile);
      file.once('close', function() {
        console.log(total, cacheHits);
        assert.equal(total, 2);
        assert.equal(cacheHits.length, 0);
        done();
      });
      new Glue()
        .include(outDir)
        .on('file', function() {
          total++;
        })
        .on('hit', function(filename){
          cacheHits.push(filename);
        })
        .set('cache-path', self.cachePath)
        .set('umd', true)
        .render(file);
    });

    build(outDir, file);

    function build(outDir, file) {
      new Glue()
        .include(outDir)
        .on('file', function() {
          total++;
        })
        .on('hit', function(filename){
          cacheHits.push(filename);
        })
        .set('cache-path', self.cachePath)
        .set('umd', true)
        .set('command', __dirname + '/../node_modules/.bin/uglifyjs')
        .render(file);
    }
  },

  'when a syntax error occurs, the build is not cached': function(done) {
    var fixture = this.fixture,
        outFile = fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = fixture.dir({
      'index.js': 'module.exports = "require("a") {{{syntax error";'
    });

    var cacheHits = [],
        total = 0;

    var self = this;

    file.once('close', function() {
      assert.equal(total, 1);
      assert.equal(cacheHits.length, 0);
      var outFile = fixture.filename({ ext: '.js' }),
            file = fs.createWriteStream(outFile);
      file.once('close', function() {
        // console.log(total, cacheHits);
        assert.equal(total, 2);
        assert.equal(cacheHits.length, 0);
        done();
      });
      build(outDir, file);
    });

    build(outDir, file);

    function build(outDir, file) {
      new Glue()
        .include(outDir)
        .on('file', function() {
          total++;
        })
        .on('hit', function(filename){
          cacheHits.push(filename);
        })
        .set('cache-path', self.cachePath)
        .set('umd', true)
        .render(file);
    }
  }
};
