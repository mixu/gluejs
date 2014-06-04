var fs = require('fs'),
    uglify = require('../lib/file-tasks/uglify.js'),
    wrap = require('../lib/file-tasks/wrap-commonjs-web.js');

var tasks = [
  wrap,
  uglify,
  process
];

var names = [ 'wrap', 'uglify', 'process' ];

var stream = { stdout: fs.createReadStream(__dirname + '/fixtures/single-file/simple.js') };

tasks.forEach(function(task, i) {
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

    instance.stderr.on('error', function() {
      console.log('stderr.error', i, names[i]);
    });

    instance.stderr.on('finish', function() {
      console.log('stderr.finish', i, names[i]);
    });
  }

  if(instance.on) {
    instance.on('error', function() {
      console.log('instance.error', i, names[i]);
    });
    instance.on('exit', function(code) {
      console.log('instance.exit', i, names[i], code);
    });
  }

  // readable stream: close and end events

  instance.stdin.on('error', function() {
    console.log('stdin.error', i, names[i]);
  });

  instance.stdin.on('finish', function() {
    console.log('stdin.finish', i, names[i]);
  });

  instance.stdin.on('end', function() {
    console.log('stdin.end', i, names[i]);
  });


  // writable stream: close and finish events

  instance.stdout.on('error', function() {
    console.log('stdout.error', i, names[i]);
  });

  instance.stdout.on('close', function() {
    console.log('stdout.close', i, names[i]);
  });

  instance.stdout.on('end', function() {
    console.log('stdout.end', i, names[i]);
  });


  stream = instance;
});




