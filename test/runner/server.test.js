var util = require('util'),
    List = require('minitask').list;

var task = require('../lib/runner/static-server.js'),
    list = new List();

list.add(__dirname+'/fixtures/single-file/');

task(list);
