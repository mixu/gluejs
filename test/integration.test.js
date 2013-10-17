var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('gluejs');

exports['integration tests'] = {

  // ADD TESTS FOR:
  // - the stream size reporter


  'can build a json file': function(done) {
    var file = fs.createWriteStream(__dirname + '/tmp/temp.js');

    file.once('close', function() {
      var result = require(__dirname + '/tmp/temp.js');
      assert.deepEqual(result,  { foo: "bar" });
      done();
    });

    new Glue()
      .basepath(__dirname +'/fixtures/json-file/')
      .include('./')
      .set('cache', false)
      .export('module.exports')
      .render(file);
  },

  '--command with unix pipe': function(done) {
    new Glue()
      .basepath(__dirname +'/fixtures/jade-file/')
      .include('./')
      .set('cache', false)
      .set('command', 'bash -c "echo \'module.exports = \"bar\";\'"')
      .export('module.exports')
      .render(function(err, txt) {
        console.log(txt);
        done();
      });
  },

  '--command with specific extension': function(done) {
    var file = fs.createWriteStream(__dirname + '/tmp/temp2.js');

    file.once('close', function() {
      var name = new Date().getTime();
      // use standard require
      var result = require(__dirname + '/tmp/temp2.js')({ name: name });
      console.log(result);
      assert.deepEqual(result, '<h1>Hello '+name+'</h1>');
      done();
    });

    var spawn = require('../lib/file-tasks/spawn.js'),
        wrapCommonJs = require('../lib/file-tasks/wrap-commonjs-web.js');

    // There are way too many internals exposed here ... must encapsulate these better.

    new Glue()
      .basepath(__dirname +'/fixtures/jade-file/')
      .include('./')
      .set('cache', false)
      .set('require', false)
      .set('command', [
        {
          expr: new RegExp('^.+\.jade$'),
          task: function(item, pkg) {
            return function() {
              return spawn({
                name: item.name, // full path
                task: 'jade --client --no-debug'
              });
            };
          }
        },
        // NOTE: run the uglify beautify on the jade output (not on the partial produced by the
        // CJS wrapper...
        {
          expr: new RegExp('^.+\.jade$'),
          task: function(item, pkg) {
            return function() {
              return spawn({
                name: item.name, // full path
                task: 'uglifyjs --no-copyright --beautify'
              });
            };
          }
        },
        {
          // wrapper 1:
          // var jade = require("jade").runtime; module.exports = <input>;
          expr: new RegExp('^.+\.jade$'),
          task: function() {
            return function(input) {
              return 'function(module, exports, require){' +
                     'var jade = require(\'jade\').runtime;\n' +
                     'module.exports = ' + (input.length === 0 ? '{}' : input) +
                     '}';
            };
          }
        }
      ])
      .main('foo.jade')
      .export('module.exports')
      .render(file);
  },

  'try brfs': function(done) {
    var brfs = require('brfs');


    new Glue()
      .basepath(__dirname +'/command-integration/')
      .include('./test.brfs.js')
      .set('cache', false)
      .set('require', false)
      .set('command', [
        {
          ext: '.brfs.js',
          task: function(file, pkg) {
            return function() {
              // note that brfs seems to only use the filename for resolving the fs calls
              return brfs(file.name);
            };
          }
        }
      ])
      .main('test.brfs.js')
      .export('module.exports')
      .render(function(err, txt) {
        console.log(txt);
        done();
      });

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

