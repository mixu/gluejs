var util = require('util'),
    Tree = require('../lib/tree.js');

var task = require('../lib/runner/static-server.js'),
    tree = new Tree();

tree.add(__dirname+'/fixtures/single-file/');

task(tree);

