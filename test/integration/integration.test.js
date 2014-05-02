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

    Minilog.suggest.defaultResult = false;
    Minilog.suggest.clear().allow(/.*/, 'info');
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

  perf: {

    'running the same build twice will make use of the cache': function() {

    },

    'changing options not passed into the runner still invalidate the cache': function() {
      // e.g. --command or no --command
    },

    'when a syntax error occurs, the build is not cached': function() {

    }
  },

  // AMD tests
  // - output as AMD
  // - convert from AMD to CommonJS

  // Middleware tests
  // - short form syntax works as expected
  // - middleware error messages
  middleware: require('./middleware-tests.js'),

  // TODO:
  // -- can specify a build with two external modules as targets
  // - production mode
  // - middleware etags support
  // - mocha test packaging mode (as plugin?)
  // - cache preheating option

  'production mode': function() {
/*
    app.use('/js/third.js', Glue.middleware({
      umd: true,
      basepath: outDir + '/third',
      include: [ './lib/index.js', './foo/bar.js' ],
      main: 'lib/index.js'

      staticFolder: (DEBUG_MODE ? false : __dirname + '/precompiled/' )
    }));
*/
  },

  'can avoid expensive operations using an etag': function() {
    // generate build

    // ask for the same build again, sending the necessary headers

    // the full build should be returned from cache
  },

  // Other

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

