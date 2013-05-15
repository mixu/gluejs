var spawn = require('child_process').spawn;

// Return a duplex stream, or alternatively an object which has a readable stream called .stdout
// and a writable stream called .stdin.
// This function is called for each file in the list of tasks.
// The output of the preceding task is piped into the writable/duplex stream,
// and the output of the readable/duplex stream is captured or piped forward
module.exports = function() {
  var task = spawn('uglifyjs', ['--no-copyright']);
  return task;
};
