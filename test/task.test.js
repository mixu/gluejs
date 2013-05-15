var fs = require('fs'),
    uglify = require('../lib/file-tasks/uglify.js'),
    wrap = require('../lib/file-tasks/wrap-commonjs-web.js');

var wrapper = wrap(),
    uglifier = uglify();

var s = fs.createReadStream(__dirname + '/fixtures/single-file/simple.js');

s.pipe(wrapper.stdin);

wrapper.stdout.pipe(uglifier.stdin);
uglifier.stdout.pipe(process.stdout);

/*
var tasks = [
  wrap,
  uglify
];

var stream = { stdout: fs.createReadStream(__dirname + '/fixtures/single-file/simple.js') };

tasks.forEach(function(task) {
  var instance = task();

  stream.stdout.pipe(instance.stdin);

  stream = instance;
});

stream.stdout.pipe(process.stdout);
*/
