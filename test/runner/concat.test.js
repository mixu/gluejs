var util = require('util'),
    List = require('minitask').list;

var concat = require('../lib/runner/concat.js'),
    list = new List();

list.add(__dirname+'/fixtures/single-file/');

concat(list);

