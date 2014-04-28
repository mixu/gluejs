var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    Glue = require('gluejs');

exports['integration tests'] = {

  before: function() {
    this.fixture = new FixtureGen();
    Minilog.enable();
    this.cachePath = require('os').tmpDir() + '/gluejs-' + new Date().getTime();
  },

  // Basic tests:
  // - producing packages from various configurations
  // - packaging a JSON file
  basic: require('./basic-tests.js'),

  // Command / transform tests:
  // - `--command` with various options
  // - `--transform` with various options
  transform: require('./transform-tests.js'),

  // File inclusion/exclusion
  // - multiple `--includes`
  // - `--exclude` should work
  // - `--ignore` should work

  'can --include multiple files': function() {

  },

  'can --include multiple folders': function() {

  },

  'can --exclude files from the build': function() {

  },

  'can --exclude 3rd party module paths from the build': function() {

  },

  'can --ignore files from the main build': function() {

  },

  'can --ignore 3rd party modules from the main build': function() {

  },

  // External module wrangling tests:
  // - `--remap` to remap an external to an expression
  // - making use of the `browser` field in package.json to replace files and modules
  // - `--external` to force a external to not be included
  // - `--no-externals` to exclude all externals
  // - `--include-external` to whitelist an external
  // - `--only-externals` to blacklist the actual files (post parse!)

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

/*
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
*/

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
  },

  // try to implement these as exclusions

  'can use --external to exclude externals at the main package': function() {

  },

  'can use --no-externals to exclude all externals': function() {

  },

  'can use --include-external to whitelist an external': function() {

  },

  'can use --only-externals to blacklist the actual files (post parse!)': function() {

  },

  // Shimming tests:
  // - Shimming modules which export global variables

  // Output:
  // - outputting source urls
  // - outputting external source maps (???)
  // - making the global require available via `--global-require`

  'can add --source-url\'s': function() {

  },

  'can --global-require to export the require implementation': function() {

  },

  // Node core shimming:
  // - core variable insertion
  // - loading core module replacements

  // Reporter tests
  // - progress
  // - file size reporter

  // Performance tests
  //

  // Middleware tests
  // - short form syntax works as expected
  // - cache preheating option
  // - middleware error messages
  // - middleware etags support

  'can fetch a build using the Express middleware': function() {

  },

  'can avoid expensive operations using an etag': function() {

  },

  // Other

  'can build a basic module with an external dependency and uglify': function() {

  },

  'can write a --umd bundle': function() {

  },

  'can build with --no-parse': function() {

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

