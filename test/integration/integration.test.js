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

  'commands should be applied to all files': function() {

  },

  'transforms should not be applied to files in external modules': function() {

  },

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

  // Performance tests
  // - running the same build twice will make use of the cache
  // - changing options passed into the runner invalidate the cache
  // - when a syntax error occurs, the build is not cached
  perf: require('./perf-tests.js'),

  // AMD tests
  // - output as AMD
  // - convert from AMD to CommonJS

  // Middleware tests
  // - short form syntax works as expected
  // - middleware error messages
  // - production mode
  // - middleware etags support
  // - fs.watch style example
  middleware: require('./middleware-tests.js'),
  // TODO:
  // -- can specify a build with two external modules as targets
  // - mocha test packaging mode (as plugin?)

  'etags should be supported when the full file is found in the cache': function() {
    // e.g. when a server is restarted
  },

  'middleware should support gzipping': function() {

  },

  // Other

  'CLI tests': function() {
    // test that it works
  },

  '--no-cache should work correctly': function() {

  },

  '.set(key, value) should produce the same result as .key(value)': function() {
    // special cases:
    // .basepath, .remap etc.
  },

  'module excludes should not be interpreted as regexps': function() {
    // right now, they are
  },

  'deleting cache items from underneath a running server': function() {

  },

  'can write a --umd bundle': function() {

  },

  'can build with --no-parse': function() {

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [
    '--colors', '--bail', '--ui', 'exports', '--reporter', 'spec', __filename
  ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

