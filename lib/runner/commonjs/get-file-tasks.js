module.exports = function(file, pkg, commands) {
  var result = [];
  if (typeof file.name !== 'string' ||
     !Array.isArray(commands)) {
    throw new Error('Invalid params to getFileCommands ' + file + commands);
  }

  // task selection from commands
  commands.forEach(function(command) {
    // to be compatible with browserify's source transforms,
    // let commands be function(filename, [packageObj]) { }
    // which return either
    // 1) a function which returns a valid minitask obj (syncfn, asyncfn, duplex, child_process or through-stream)
    // 2) or a falsey value (= skip)

    // note that this not the exact API that browserify follows, since
    // we return functions that return functions - rather than directly returning a stream
    // this is to avoid running out of resources when setting up the queue of tasks to run
    var task = command(file.name, pkg);
    if (task) {
      // console.log('queue', file.name, task.toString());
      result.push(task);
    }
  });
  return result;
};


