var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('gluejs'),
    FixtureGen = require('./lib/fixture-gen.js');

exports['integration tests'] = {

  // ADD TESTS FOR:
  // - the stream size reporter

  before: function() {
    this.fixture = new FixtureGen();
  },

  'can build a json file': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var inDir = this.fixture.dir({
      'index.js': 'module.exports = require("./foo.json");\n',
      'foo.json': '{ "foo": "bar" }\n'
    });

    file.once('close', function() {
      var result = require(outFile);
      assert.deepEqual(result,  { foo: "bar" });
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./')
      .set('cache', false)
      .export('module.exports')
      .render(file);
  },

  'jade file tests': {

    before: function() {
      this.jadeDir = this.fixture.dir({
        'foo.jade': [
          "h1",
          "  | Hello",
          "  = ' ' + name"
        ],
        'index.js': "module.exports = 'index.js';\n"
      });
    },

    '--command with unix pipe': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' }),
          file = fs.createWriteStream(outFile);

        file.once('close', function() {
          var result = require(outFile);
          assert.deepEqual(result,  'BAR');
          done();
        });

        new Glue()
          .basepath(this.jadeDir)
          .include('./')
          .set('cache', false)
          .set('command', 'bash -c "echo \'module.exports = \"BAR\";\'"')
          .export('module.exports')
          .render(file);
    },

    '--command with specific extension': function(done) {
      var outFile = this.fixture.filename({ ext: '.js' }),
          file = fs.createWriteStream(outFile);

      file.once('close', function() {
        var name = new Date().getTime();
        // use standard require
        var result = require(outFile)({ name: name });
        assert.deepEqual(result, '<h1>Hello '+name+'</h1>');
        done();
      });

      var spawn = require('../lib/file-tasks/spawn.js'),
          wrapCommonJs = require('../lib/file-tasks/wrap-commonjs-web.js');

      // There are way too many internals exposed here ... must encapsulate these better.

      new Glue()
        .basepath(this.jadeDir)
        .include('./')
        .set('cache', false)
        .set('require', false)
        .set('command', [
          function(filename, pkg) {
            if(path.extname(filename) != '.jade') {
              return;
            }
            return function() {
              return spawn({
                name: filename, // full path
                task: __dirname + '/node_modules/.bin/jade --client --no-debug'
              });
            };
          },
          // NOTE: run the uglify beautify on the jade output (not on the partial produced by the
          // CJS wrapper...
          function(filename, pkg) {
            if(path.extname(filename) != '.jade') {
              return;
            }
            return function() {
              return spawn({
                name: filename, // full path
                task: __dirname + '/node_modules/.bin/uglifyjs --no-copyright --beautify'
              });
            };
          },
          // wrapper:
          // var jade = require("jade").runtime; module.exports = <input>;
          function(filename, pkg) {
            if(path.extname(filename) != '.jade') {
              return;
            }
            return function(input) {
              return 'function(module, exports, require){' +
                      // workaround for the fact that these things reside in a temp directory
                      // and so do not have jade in their immediate path
                     'var jade = require("' + __dirname + '/node_modules/jade'+ '").runtime;\n' +
                     'module.exports = ' + (input.length === 0 ? '{}' : input) +
                     '}';
            };
          }
        ])
        .main('foo.jade')
        .export('module.exports')
        .render(file);
    },
  },

  'try brfs': function(done) {
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
      .set('command', [
        function(filename, pkg) {
          return function() {
            // note that brfs seems to only use the filename for resolving the fs calls
            return require('brfs')(filename);
          };
        }
      ])
      .main('test.brfs.js')
      .export('module.exports')
      .render(file);

  },

  'try coffeeify': function(done) {
    var inDir = this.fixture.dir({
      'test.coffee': [
        "square = (x) -> x * x",
        "module.exports = square",
        ""
      ],
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      // use standard require
      var result = require(outFile);
      assert.deepEqual(result(3), 9);
      assert.deepEqual(result(5), 25);
      done();
    });

    new Glue()
      .basepath(inDir)
      .include('./test.coffee')
      .set('cache', false)
//      .set('report', true)
      .set('transform', 'coffeeify')
      .main('test.coffee')
      .export('module.exports')
      .render(file);

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

