var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Minilog = require('minilog');
var FixtureGen = require('../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    Glue = require('gluejs');

var path = require('path'),
    spawn = require('../../lib/file-tasks/spawn.js');

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

  // Renaming and shimming tests:
  // - Shimming modules which export global variables
  // - `--remap`
  // - making use of the `browser` field in package.json to replace files and modules

  // Build splitting
  // - `--no-externals` / `--only-externals`

  // Output:
  // - Source URLs and source maps
  //  - adding in source urls
  //  - generating external source maps
  // - `--global-require`

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


  'can specify a single string --command': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result,  'BAR');
      done();
    });

    new Glue()
      .basepath(outDir)
      .include('./')
      .set('cachePath', this.cachePath)
      .set('command', 'bash -c "echo \'module.exports = \"BAR\";\'"')
      .set('umd', true)
      .render(file);
  },

  'can specify an array of string --commands': function(done) {
    // commandline: coffee and uglifyjs
    var inDir = this.fixture.dir({
      'index.coffee': [
        "square = (x) -> x * x",
        "module.exports = square",
        ""
      ],
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      // console.log(fs.readFileSync(outFile).toString());
      // use standard require
      var result = require(outFile);
      assert.deepEqual(result(3), 9);
      assert.deepEqual(result(5), 25);
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./')
      .set('cache', false)
      .set('command', [
        __dirname + '/../node_modules/coffee-script/bin/coffee --compile --stdio',
        __dirname + '/../node_modules/.bin/uglifyjs',
      ])
      .main('index.coffee')
      .export('module.exports')
      .render(file);

  },

  'can specify an array of function --commands': function(done) {
    // jade
    var outDir = this.fixture.dir({
      'foo.jade': [
        "h1",
        "  | Hello",
        "  = ' ' + name"
      ],
      'index.js': 'module.exports = require("./foo.jade");'
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      var result = require(outFile);
      // use standard require
      var result = result({ name: name });
      assert.deepEqual(result, '<h1>Hello '+name+'</h1>');
      done();
    });

    // There are way too many internals exposed here ... must encapsulate these better.

    new Glue()
      .basepath(outDir)
      .include('./index.js')
      .set('cache', false)
      .set('require', false)
      .set('command', [
        function(filename) {
          if(path.extname(filename) != '.jade') {
            return;
          }
          return function() {
            return spawn({
              name: filename, // full path
              task: __dirname + '/../node_modules/.bin/jade --client --no-debug'
            });
          };
        },
        // NOTE: run the uglify beautify on the jade output (not on the partial produced by the
        // CJS wrapper...
        function(filename) {
          if(path.extname(filename) != '.jade') {
            return;
          }
          return function() {
            return spawn({
              name: filename, // full path
              task: __dirname + '/../node_modules/.bin/uglifyjs --no-copyright --beautify'
            });
          };
        },
        // wrapper:
        // var jade = require("jade").runtime; module.exports = <input>;
        function(filename) {
          if(path.extname(filename) != '.jade') {
            return;
          }
          return function(input) {
            // workaround for the fact that these things reside in a temp directory
            // and so do not have jade in their immediate path
            return 'var jade = require("' + __dirname + '/../node_modules/jade/runtime'+ '");\n' +
                   'module.exports = ' + (input.length === 0 ? '{}' : input);
          };
        }
      ])
      .main('foo.jade')
      .export('module.exports')
      .render(file);
  },

  // transforms should only be strings - if you want
  // to specify things programmatically, use set('command', [ fn ])

  'can specify a single string --transform': function(done) {
    var inDir = this.fixture.dir({
      'robot.html': 'I am a robot',
      'test.brfs.js': [
        "var fs = require('fs');",
        "var html = fs.readFileSync(__dirname + '/robot.html');",
        "module.exports = html;",
        ""
      ],
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      // console.log(fs.readFileSync(outFile).toString());
      // use standard require
      var result = require(outFile);
      assert.deepEqual(result, 'I am a robot');
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./test.brfs.js')
      .set('cache', false)
      .set('require', false)
      .set('transform', 'brfs')
      .main('test.brfs.js')
      .export('module.exports')
      .render(file);
  },

  'can specify an array of string transforms': function(done) {
    // coffeify plus run brfs
    var inDir = this.fixture.dir({
      'robot.html': 'I am a robot',
      'test.coffee': [
        "square = (x) -> x * x",
        "module.exports = { square: square, robot: require('fs').readFileSync(__dirname + '/robot.html') }",
        ""
      ],
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      // console.log(fs.readFileSync(outFile).toString());
      // use standard require
      var result = require(outFile);
      assert.deepEqual(result.square(3), 9);
      assert.deepEqual(result.square(5), 25);
      assert.deepEqual(result.robot, 'I am a robot');
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./test.coffee')
      .set('cache', false)
      .set('transform', [ 'coffeeify', 'brfs' ])
      .main('test.coffee')
      .export('module.exports')
      .render(file);
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

  'can fetch a build using the Express middleware': function() {

  },

  'can avoid expensive operations using an etag': function() {

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

