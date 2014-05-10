var spawn = require('child_process').spawn;

// Return a duplex stream, or alternatively an object which has a readable stream called .stdout
// and a writable stream called .stdin.
// This function is called for each file in the list of tasks.
// The output of the preceding task is piped into the writable/duplex stream,
// and the output of the readable/duplex stream is captured or piped forward
module.exports = function(options) {
  if (typeof options.task === 'string') {
    // parse quoted string variants:
    // 1) not whitespace, not quote followed by not whitespace OR
    // 2) double quote followed by not double quote or escaped double quote followed by double OR
    // 3) single quote followed by not single quote or escaped single quote followed by single
    options.task = options.task.match(
      /([^ \t\r\n"'][^ \t\r\n]*)|"(?:[\]["]|[^"])+"|'(?:[\][']|[^'])+'/g
    );
    // since we're using uv_spawn which calls out to exec(3), we need to exclude the beginning quotes
    options.task = options.task.map(function(i, index) {
      if (index > 0 &&
          i.charAt(0) == i.charAt(i.length - 1) &&
          (i.charAt(0) == '"' || i.charAt(0) == "'")
          ) {
        return i.substring(1, i.length - 1);
      }
      return i;
    });
  }
  var task = spawn.call(this, options.task[0], options.task.slice(1));

  var stderr = '',
      stdout = '';

  task.stdout.on('data', function (data) {
    stdout += data;
  });

  task.stderr.on('data', function (data) {
    stderr += data;
  });

  // The child_process API only emits errors when invoking the task fails.
  // To more closely match normal streams, listen for "exit" with exit status != 0 and emit
  // a error.
  task.on('exit', function(code) {
    if (code !== 0) {
      console.log('');
      console.log('gluejs - An error occured while executing: "' + options.task.join(' ') + '"');
      console.log('Input file: "' + options.name + '"');
      console.log('Exit code: ' + code);
      console.log('Check the input file for syntax errors or other issues that could cause ' +
        'the child process above to fail.');
      console.log();
      console.log('Standard output from child process:');
      console.log(stdout);
      console.log('Standard error output from child process:');
      console.log(stderr);
      task.emit('error', new Error('Child process exited with nonzero exit code: ' + code));
    }
    stderr = '';
    stdout = '';
  });
  return task;
};
