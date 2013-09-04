var spawn = require('child_process').spawn;

// Return a duplex stream, or alternatively an object which has a readable stream called .stdout
// and a writable stream called .stdin.
// This function is called for each file in the list of tasks.
// The output of the preceding task is piped into the writable/duplex stream,
// and the output of the readable/duplex stream is captured or piped forward
module.exports = function(options) {
  if(typeof options.task === 'string') {
    // parse quoted string variants:
    // 1) not whitespace, not quote followed by not whitespace OR
    // 2) double quote followed by not double quote or escaped double quote followed by double quote OR
    // 3) single quote followed by not single quote or escaped single quote followed by single quote
    options.task = options.task.match(/([^ \t\r\n"'][^ \t\r\n]*)|"(?:[\]["]|[^"])+"|'(?:[\][']|[^'])+'/g);
    // since we're using uv_spawn which calls out to exec(3), we need to exclude the beginning quotes
    options.task = options.task.map(function(i, index) {
      if(index > 0 && i.charAt(0) == i.charAt(i.length-1) && (i.charAt(0) == '"' || i.charAt(0) == "'")) {
        return i.substring(1, i.length-1);
      }
      return i;
    });
  }
  var task = spawn.call(this, options.task[0], options.task.slice(1));

  // The child_process API only emits errors when invoking the task fails.
  // To more closely match normal streams, listen for "exit" with exit status != 0 and emit
  // a error.
  task.on('exit', function(code) {
    if(code !== 0) {
      console.log('');
      console.log('spawn-task: "' +options.task.join(' ')+ '" on "'+ options.name+ '" exited with nonzero exit code: '+ code);
      task.emit('error', new Error('Child process exited with nonzero exit code: '+ code));
    }
  });
  return task;
};
