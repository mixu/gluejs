var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    List = require('minitask').list;

exports['given a list'] = {

  beforeEach: function() {
    this.list = new List();
  },

  'can add a single file': function () {
    var g = this.list;
    var result = g.add(__dirname+'/fixtures/single-file/simple.js').files;
    assert.equal(result.length, 1);
    assert.deepEqual(result, [
      { name: path.normalize(__dirname+'/fixtures/single-file/simple.js') },
    ]);
  },

  'can add a directory': function() {
    var g = this.list;
    var result = g.add(__dirname+'/fixtures/single-file/').files;
    assert.equal(result.length, 2);
    assert.deepEqual(result, [
      { name: path.normalize(__dirname+'/fixtures/single-file/has_dependency.js') },
      { name: path.normalize(__dirname+'//fixtures/single-file/simple.js') },
    ]);
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
