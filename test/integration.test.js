var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('gluejs');

exports['integration tests'] = {

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
      .export('module.exports')
      .render(file);
  },

  '--command with unix pipe': function(done) {
    new Glue()
      .basepath(__dirname +'/fixtures/jade-file/')
      .include('./')
      .set('command', 'bash -c "echo \'module.exports = \"bar\";\'"')
      .export('module.exports')
      .render(function(err, txt) {
        console.log(txt);
        setTimeout(done, 1);
      });
  },

/*
  TODO: add back when getFileTasks supports "expr" matching in addition to "ext" matching

  '--command with specific extension': function(done) {
    var file = fs.createWriteStream(__dirname + '/tmp/temp2.js');

    file.once('close', function() {
      var name = new Date().getTime();
      // use standard require
      var result = require(__dirname + '/tmp/temp2.js')({ name: name });
      assert.deepEqual(result, '<h1>Hello '+name+'</h1>');
      done();
    });

    new Glue()
      .basepath(__dirname +'/fixtures/jade-file/')
      .include('./')
      .set('require', false)
      .set('command', [
        {
          expr: new RegExp('^.+\.jade$'),
          cmd: 'jade --client --no-debug',
          wrap: 'exports'
          // cmd: 'bash -c "echo \'module.exports = \"bar\";\'"'
        },
        {
          expr: new RegExp('^.+\.jade$'),
          cmd: 'uglifyjs --no-copyright'
        }
      ])
      .main('foo.jade')
      .export('module.exports')
      .render(file);
  }
*/

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

