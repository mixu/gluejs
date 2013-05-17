var assert = require('assert');
    util = require('util');

var stat = require('../../lib/tree-tasks/annotate-stat.js'),
    Tree = require('../../lib/tree.js');

var tree = new Tree();

tree.add(__dirname+'/../fixtures/single-file/');

exports['annotate-stat'] = {

  'can stat the tree': function() {
    stat(tree);
    //console.log(util.inspect(tree, null, 10, true));
    // each file has a stat property now
    assert.ok(tree.files.every(function(file) {
      return typeof file.stat == 'object';
    }));
  }
};


