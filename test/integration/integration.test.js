var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    Glue = require('gluejs');

var express = require('express'),
    request = require('request');

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
  exclude: require('./exclude-tests.js'),

  // External module wrangling tests:
  // - `--remap` to remap an external to an expression
  // - making use of the `browser` field in package.json to replace files and modules
  // - `--external` to force a external to not be included
  // - `--no-externals` to exclude all externals
  // - `--include-external` to whitelist an external
  // - `--only-externals` to blacklist the actual files (post parse!)

  // TODO NOT IMPLEMENTED: can use the browser field to replace the main package
  externals: require('./externals-tests.js'),

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
  // - shimmed global export: modules which export global variables

  'can --shim an external file in place of a name at the top level': function() {

  },

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

  'can use --detect-globals to add global variable definitions': function() {

  },

  'can use --builtins to load node core module replacements': function() {

  },

  // Reporter tests
  // - progress
  // - file size reporter

  // Performance tests
  // - run the same build twice, check the number of cached items
  // - run the same build, with syntax error, twice, check cached items

  // AMD tests
  // - output as AMD
  // - convert from AMD to CommonJS

  // Middleware tests
  // - short form syntax works as expected
  // - cache preheating option
  // - middleware error messages
  // - middleware etags support
  // - production mode
  // - mocha test packaging mode (as plugin?)

  'middleware': {

    before: function(done) {
      // create fixtures
      var outDir = this.fixture.dir({
        // one main file with deps
        'first/index.js': 'module.exports = require("dep");',
        'first/node_modules/dep/index.js': 'module.exports = "Dep";',
        'first/node_modules/dep2/index.js': 'module.exports = "Dep2";',
        'third/lib/index.js': 'module.exports = true;',
        'third/foo/bar.js': 'module.exports = true;',
        'syntax/index.js': 'module.exports = require("foo");',
        'syntax/err.js': '}syntax error['
      });
      // initialize routes
      var app = express();
      // first: single main file + all deps
      app.use('/js/first.js', Glue.middleware(outDir + '/first/index.js', { umd: true}));
      // second: two external dependencies
      app.use('/js/second.js', Glue.middleware([ 'dep', 'dep2' ], {
        umd: true,
        basepath: outDir + '/first',
        'global-require': true
      }));
      // third: full invocation
      app.use('/js/third.js', Glue.middleware({
        umd: true,
        basepath: outDir + '/third',
        include: [ './lib/index.js', './foo/bar.js' ],
        main: 'lib/index.js'
      }));
      // syntax error
      app.use('/js/syntax.js', Glue.middleware(outDir + '/syntax/index.js', { umd: true }));

      app.use(function(req, res, next){
        console.log('%s %s', req.method, req.url);
        next();
      });

      this.app = app;
      this.server = app.listen(3000, done);
    },

    after: function(done) {
      this.server.close(done);
    },

    'can specify a middleware build with a single file target': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' });
      request.get('http://localhost:3000/js/first.js',
        function(err, res, body) {
          assert.equal(res.statusCode, 200);
          fs.writeFileSync(outFile, body);
          var result = require(outFile);
          console.log(body);
          assert.deepEqual(result, "Dep");
          done();
        });
    },

    'can specify a build with two external modules as targets': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' });
      request.get('http://localhost:3000/js/second.js',
        function(err, res, body) {
          assert.equal(res.statusCode, 200);
          fs.writeFileSync(outFile,
            body +
            '\n\nmodule.exports = require;'
            );
          var result = require(outFile);
          // console.log(fs.readFileSync(outFile).toString());
          assert.deepEqual(result('dep'), "Dep");
          assert.deepEqual(result('dep2'), "Dep2");
          done();
        });
    },

    'can specify a build with full options': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' });
      request.get('http://localhost:3000/js/third.js',
        function(err, res, body) {
          assert.equal(res.statusCode, 200);
          fs.writeFileSync(outFile,
            body +
            '\n\nmodule.exports = require;'
            );
          var result = require(outFile);
          // console.log(fs.readFileSync(outFile).toString());
          assert.deepEqual(result('dep'), "Dep");
          assert.deepEqual(result('dep2'), "Dep2");
          done();
        });
    },

    'when a syntax error occurs, middleware returns errors as expected': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' });
      request.get('http://localhost:3000/js/third.js',
        function(err, res, body) {
          // returns error coce
          assert.equal(res.statusCode, 500);
          // prints to console
          // appends div (not testable)
          fs.writeFileSync(outFile);
          console.log(fs.readFileSync(outFile).toString());
          done();
        });
    },

    'can avoid expensive operations using an etag': function() {

    }

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

