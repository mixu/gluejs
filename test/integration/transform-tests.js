var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Glue = require('gluejs');

var path = require('path'),
    spawn = require('../../lib/file-tasks/spawn.js');

module.exports = {
  'can specify a single string --command': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    var outDir = this.fixture.dir({
      'index.js': 'module.exports = "Index";'
    });

    file.once('close', function() {
      // console.log(fs.readFileSync(outFile).toString());
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
      // .js so that --command is applied
      'index.coffee.js': [
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
      .include('./index.coffee.js')
      .set('cache', false)
      .set('command', [
        __dirname + '/../node_modules/coffee-script/bin/coffee --compile --stdio',
        __dirname + '/../node_modules/.bin/uglifyjs',
      ])
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
      // console.log(fs.readFileSync(outFile).toString());
      var result = require(outFile);
      // use standard require
      result = result({ name: name });
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
      .export('module.exports')
      .render(file);
  },

  '--command: parse the resulting file for dependencies': function(done) {
    // jade
    var outDir = this.fixture.dir({
      'foo.bar': 'AAAA',
      'index.js': 'module.exports = require("./foo.bar");',
      'node_modules/bar.js': 'module.exports = "Hello from Bar";'
    });

    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);

    file.once('close', function() {
      var name = new Date().getTime();
      // console.log(fs.readFileSync(outFile).toString());
      var result = require(outFile);
      // use standard require
      assert.deepEqual(result, 'Hello from Bar');
      done();
    });

    // There are way too many internals exposed here ... must encapsulate these better.

    new Glue()
      .basepath(outDir)
      .include('./index.js')
      .set('cache', false)
      .set('command', [
        function(filename) {
          if(path.extname(filename) != '.bar') {
            return;
          }
          return function(input) {
            return 'module.exports = require("bar");';
          };
        }
      ])
      .set('umd', true)
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
      .export('module.exports')
      .render(file);
  },

  'print pretty error when a --command fails': function(done){
    var outFile = this.fixture.filename({ ext: '.js' }),
        file = fs.createWriteStream(outFile);
    var outDir = this.fixture.dir({
      'index.js': '}|alksdjklasdkljaskldaskldjklasjdklasjd'
    });

    var spawn = require('child_process').spawn;
    var path = require('path');

    var ps = spawn(path.resolve(__dirname + '../../../bin/gluejs'), [
      '--include', outDir,
      '--cache-path', this.cachePath,
      '--umd',
      '--command', 'node -e "throw new Error(\'STDERR-error\')"'
    ]);

    var stderr = '',
        stdout = '';

    ps.stderr.on('data', function (data) {
      stderr += data;
    });

    ps.stdout.on('data', function (data) {
      stdout += data;
    });

    ps.on('exit', function(code) {
      // console.log(stderr, stdout);
      assert.notEqual(code, 0);
      assert.notEqual(stdout.indexOf('STDERR-error'), -1);
      done();
    });
  }
};
