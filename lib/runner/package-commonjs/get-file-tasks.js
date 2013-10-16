module.exports = function(file, pkg, commands) {
  var result = [];
  if(typeof file.name !== 'string' ||
     !Array.isArray(commands)) {
    throw new Error('Invalid params to getFileCommands ' + file + commands);
  }

  // task selection from commands
  commands.forEach(function(command) {
    // ext matching (note: can be ".test.js" or some other longer postfix)
    if(typeof command.ext === 'string' &&
       file.name.substr(file.name.length - command.ext.length).toLowerCase() == command.ext) {
      // the task is a function (file, package) which returns another function (used in the task)
      result.push(command.task(file, pkg));
    } else if(command.expr && command.expr.test(file.name)) {
      // expr matching (this is not used in the internal commands, but can be activated
      // by the user replacing the commands array with a custom set of commands)
      result.push(command.task(file, pkg));
    }
  });
  return result;
};


