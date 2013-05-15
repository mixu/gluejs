var util = require('util');

var stat = require('../lib/tree-tasks/stat.js'),
    Tree = require('../lib/tree.js');

var tree = new Tree();

tree.add(__dirname+'/fixtures/single-file/');

stat(tree);

console.log(util.inspect(tree, null, 10, true));
