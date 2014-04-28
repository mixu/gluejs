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

  'can --exclude 3rd party module paths from the build': function(done) {
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
      // console.log(fs.readFileSync(outFile).toString());
      assert.deepEqual(result, { });
      done();
    });

    new Glue()
    .include(outDir)
    .set('cachePath', this.cachePath)
    .set('umd', true)
    .set('ignore', [ 'foo' ])
    .render(file);
  },

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

  'can fetch a build using the Express middleware': function() {
    // first

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = require("./second.js");',
      'second.js': 'module.exports = "Second";'
    });


    var express = require('express'),
        glue = require('gluejs'),
        app = express();

    app.use(express.static(__dirname));

    // first: single main file + all deps
    app.use('/js/main.js', glue.middleware('./client/index.js'));

    // second: two external dependencies
    app.use('/js/main.js', glue.middleware([ 'foo', 'bar' ]));

    // third: paths plus options
    app.use('/js/main.js', glue.middleware([ 'foo', 'bar' ], { ignore: 'bar' }));

    // fourth: full invocation
    app.use('/app.js', glue.middleware({
      basepath: __dirname + '/../',
      include: [ './express/lib/index.js', './express/foo/bar.js' ],
      main: 'express/lib/index.js'
    }));

    app.use(function(req, res, next){
      console.log('%s %s', req.method, req.url);
      next();
    });

    app.listen(3000);
    console.log('Listening on port 3000');
  },

  'when a syntax error occurs, middleware returns errors as expected': function() {
    // returns error coce
    // prints to console
    // appends div (not testable)
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

