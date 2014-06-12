var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Glue = require('gluejs');

module.exports = {


  'can --include multiple files': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require;',
      'lib/foo.js': 'module.exports = "Foo";',
      'lib/bar.js': 'module.exports = "Bar";',
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(result);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result('./lib/foo.js'), "Foo");
      assert.deepEqual(result('./lib/bar.js'), "Bar");
      done();
    });

    new Glue()
      .include(outDir + '/index.js')
      .include(outDir + '/lib/foo.js')
      .include(outDir + '/lib/bar.js')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .set('global-require', true)
      .render(file);
  },

  'can --include multiple folders': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require;',
      'foo/index.js': 'module.exports = require("./foo");',
      'foo/foo.js': 'module.exports = "Foo2";',
      'bar/index.js': 'module.exports = require("./bar");',
      'bar/bar.js': 'module.exports = "Bar2";',
    });

    file.once('close', function() {
      // console.log(fs.readFileSync(outFile).toString());
      var result = require(outFile);
      // console.log(result);

      // Note: this is actually dependent on the require() impl handling of paths..
      assert.deepEqual(result('./foo/index.js'), "Foo2");
      assert.deepEqual(result('./bar/index.js'), "Bar2");
      done();
    });

    new Glue()
      .include(outDir + '/index.js')
      .include(outDir + '/foo')
      .include(outDir + '/bar')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .set('global-require', true)
      .render(file);
  },

  'can --exclude files from the build': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = "Second";'
    });

    file.once('close', function() {
      fs.writeFileSync(outFile,
        'function require(str) { return "extern-" + str; }\n' +
        fs.readFileSync(outFile));

      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result, "extern-./second.js");
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .set('exclude', [ './second.js' ])
    .render(file);
  },

  'can --exclude 3rd party modules from the build': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/package.json': '{ "main": "main.js" }',
      'node_modules/foo/main.js': 'module.exports = "Foo";',
    });

    file.once('close', function() {
      fs.writeFileSync(outFile,
        'function require(str) { return "extern-" + str; }\n' +
        fs.readFileSync(outFile));

      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result, "extern-foo");
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .set('exclude', [ 'foo' ])
    .render(file);
  },

  'can --ignore files from the main build': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = "Second";'
    });

    file.once('close', function() {
      var result = require(outFile);
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result, { });
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .set('ignore', [ './second.js' ])
    .render(file);
  },

  'can --ignore 3rd party modules from the main build': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/package.json': '{ "main": "main.js" }',
      'node_modules/foo/main.js': 'module.exports = "Foo";',
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, {});
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .set('ignore', [ 'foo' ])
    .render(file);
  },

  '--ignore works even for bad third party module references like require("jade/runtime")': function(done) {
    done();
  }

};
