var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('gluejs');

exports['integration tests'] = {

  'can build a json file': function(done) {
    var Glue = require('gluejs'),
        file = fs.createWriteStream(__dirname + '/tmp/temp.js');

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
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

