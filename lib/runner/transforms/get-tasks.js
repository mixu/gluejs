var path = require('path');

var spawn = require('../../file-tasks/spawn.js');

module.exports = function(filename, options) {
  var tasks = [];
  // 1st: any custom commands (in array order)

  if (Array.isArray(options.command)) {
    var isObjectArray = options.command.every(function(item) {
      return typeof item === 'function';
    });

    if (isObjectArray) {
      tasks = options.command;
    } else {
      // basically, an array of strings
      throw new Error('Unknown --command format.');
    }
  } else if (typeof options.command === 'string' &&
             path.extname(filename) == '.js') {
    // "simple mode": one --command which only applies to .js files
    tasks.push(function() {
      return spawn({
        name: filename, // full path
        task: options.command
      });
    });
  }

  // 2nd: transforms


  return tasks;
};
