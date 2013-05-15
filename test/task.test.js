var fs = require('fs'),
    uglify = require('../lib/file-tasks/uglify.js'),
    wrap = require('../lib/file-tasks/wrap-commonjs-web.js');

var tasks = [
  wrap,
//  uglify,
  process
];

var stream = { stdout: fs.createReadStream(__dirname + '/fixtures/single-file/simple.js') };

tasks.forEach(function(task) {
  var instance = task;
  // item is either a object (e.g. process) with .stdout/.stdin
  // or a function that returns an object
  if(typeof instance == 'function') {
    instance = task();
  }
  stream.stdout.pipe(instance.stdin);
  // if there is a stderr, pipe that - this avoids issues where the task fails to stderr
  // and the stdout is not flushed due to buffering
  if(instance.stderr) {
    instance.stderr.pipe(process.stderr);
  }

  stream = instance;
});


