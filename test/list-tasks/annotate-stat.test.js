var assert = require('assert');
    util = require('util');

var stat = require('../../lib/list-tasks/annotate-stat.js'),
    List = require('minitask').list;

var list = new List();

list.add(__dirname+'/../fixtures/single-file/');

exports['annotate-stat'] = {

  'can stat the list': function(done) {
    list.exec(function(err, files) {

      stat({ files: files });
      //console.log(util.inspect(files, null, 10, true));
      // each file has a stat property now
      assert.ok(files.every(function(file) {
        return typeof file.stat == 'object';
      }));
      done();
    });
  }
};


