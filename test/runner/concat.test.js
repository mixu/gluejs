var util = require('util'),
    Tree = require('../lib/tree.js');

var concat = require('../lib/runner/concat.js'),
    tree = new Tree();

tree.add(__dirname+'/fixtures/single-file/');

concat(tree);

