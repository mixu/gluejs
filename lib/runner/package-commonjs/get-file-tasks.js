module.exports = function(file, pkg, commands) {
  var result = [];
  if(typeof file.name !== 'string' ||
     !Array.isArray(commands)) {
    throw new Error('Invalid params to getFileCommands ' + file + commands);
  }

  // task selection from commands
  commands.forEach(function(command) {
    // for now, only support ext (note: can be ".test.js" or some other longer postfix)
    if(file.name.substr(file.name.length - command.ext.length).toLowerCase() == command.ext) {
      // the task is a function (file, package) which returns another function (used in the task)
      result.push(command.task(file, pkg));
    }
  });
  return result;
};


