var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Glue = require('gluejs');

module.exports = {

  'can --remap an external to an expression': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("external");'
    });

    file.once('close', function() {
      fs.writeFileSync(outFile,
        'function require(str) { return "extern-" + str; }\n' +
        fs.readFileSync(outFile));
      var result = require(outFile);
      assert.deepEqual(result, 'extern-LOOKUP');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .remap('external', 'require("LOOKUP")')
      .render(file);
  },

  'can --remap multiple': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = { first: require("first"), second: require("second") };'
    });

    file.once('close', function() {
      fs.writeFileSync(outFile,
        'function require(str) { return "extern-" + str; }\n' +
        fs.readFileSync(outFile));
      var result = require(outFile);
      assert.deepEqual(result.first, 'extern-FIRST');
      assert.deepEqual(result.second, 'extern-SECOND');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .remap({
        first: 'require("FIRST")',
        second: 'require("SECOND")'
      })
      .render(file);
  },

  'modules with --remapped names should not be included in the build': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = { first: require("first"), second: require("second") };',
      'node_modules/first.js': 'module.exports = "First";',
      'node_modules/second/index.js': 'module.exports = require("sub");',
      'node_modules/second/node_modules/sub.js': 'module.exports = "Second";',
    });

    var added = [];

    file.once('close', function() {
      console.log(added);
      assert.equal(added.length, 1);
      assert.deepEqual(added, [ outDir + '/index.js' ]);
      done();
    });

    new Glue()
      .on('file', function(filename) {
        added.push(filename);
      })
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .remap({
        first: '"FOO"',
        second: '"BAR"'
      })
      .render(file);

  },

/*
  'can use the browser field to replace the main package': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "original";\n',
      'dist/browser.js': 'module.exports = "browser";\n',
      'package.json': JSON.stringify({
        browser: 'dist/browser.js'
      })
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'browser');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./index.js')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },

*/

  'can use the browser field to replace a 3rd party module': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");\n',
      'node_modules/foo/index.js': 'module.exports = "foo-index";\n',
      'node_modules/foo/dist/browser.js': 'module.exports = "foo-browser";\n',
      'node_modules/foo/package.json': JSON.stringify({
        main: 'index.js',
        browser: 'dist/browser.js'
      })
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'foo-browser');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },

  'can use the browser field to replace files in the main package': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./lib/filters");\n',
      'lib/filters.js': 'module.exports = "lib-filters"',
      'lib/filters-client.js': 'module.exports = "lib-filters-client"',
      'package.json': JSON.stringify({
        browser: {
          './lib/filters.js': "./lib/filters-client.js"
        }
      })
    });
    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'lib-filters-client');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },

  'can use the browser field to replace files in 3rd party': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("foo");\n',
      'node_modules/foo/lib/filters.js': 'module.exports = "lib-filters"',
      'node_modules/foo/lib/filters-client.js': 'module.exports = "lib-filters-client"',
      'node_modules/foo/foobar.js': 'module.exports = require("./lib/filters");',
      'node_modules/foo/package.json': JSON.stringify({
        main: "foobar.js", // looks like setting main AND replacing it is not supported...
        browser: {
          './lib/filters.js': "./lib/filters-client.js"
        }
      })
    });
    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'lib-filters-client');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },


  'can use the browser field to replace modules in the main package': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("x");\n',
      'package.json': JSON.stringify({
        browser: {
          'x': 'browser-x'
        }
      }),
      'node_modules/x.js': 'module.exports = "hi-from-x";\n',
      'node_modules/browser-x.js': 'module.exports = "hi-from-browser-x";\n'
    });
    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'hi-from-browser-x');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('umd', true)
      .render(file);
  },


  'can use the browser field to replace modules in 3rd party': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("bar");\n',
      'node_modules/bar/index.js': 'module.exports = require("abc");\n',
      'node_modules/bar/package.json': JSON.stringify({
        browser: {
          'abc': 'browser-abc'
        }
      }),
      'node_modules/bar/node_modules/abc/index.js': 'module.exports = "hi-from-abc";\n',
      'node_modules/bar/node_modules/browser-abc.js': 'module.exports = "hi-from-browser-abc";\n'
    });
    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result, 'hi-from-browser-abc');
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
