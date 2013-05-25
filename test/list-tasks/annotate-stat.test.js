var assert = require('assert');
    util = require('util');

var stat = require('../../lib/list-tasks/annotate-stat.js'),
    List = require('minitask').list;

var list = new List();

list.add(__dirname+'/../fixtures/single-file/');

exports['annotate-stat'] = {

  'can stat the list': function() {
    stat(list);
    //console.log(util.inspect(list, null, 10, true));
    // each file has a stat property now
    assert.ok(list.files.every(function(file) {
      return typeof file.stat == 'object';
    }));
  }
};


