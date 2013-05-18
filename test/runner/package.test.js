var util = require('util'),
    Tree = require('../../lib/tree.js');

var task = require('../../lib/runner/package-commonjs'),
    tree = new Tree();

tree.add(__dirname+'/../fixtures/complex-package/');

task(tree, { basepath: __dirname+'/../fixtures/complex-package/'} );

