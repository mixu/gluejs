var util = require('util'),
    List = require('minitask').list;

var task = require('../../lib/runner/commonjs'),
    list = new List();

list.add(__dirname+'/../fixtures/complex-package/');

task(list, { basepath: __dirname+'/../fixtures/complex-package/'} );

