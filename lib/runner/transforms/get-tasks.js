module.exports = function(filename, options) {
  var tasks = [];
  // 1st: any custom commands (in array order)

  if (Array.isArray(options.command)) {
    var isObjectArray = options.command.every(function(item) {
      return typeof item === 'function';
    });

    if(isObjectArray) {
      tasks = options.command;
    } else {
      // basically, an array of strings
      throw new Error('Unknown --command format.');
    }
  } else if(typeof options.command === 'string') {
    // "simple mode": one --command which only applies to .js files
    tasks.push(function(filename) {
      if(path.extname(filename) != '.js') {
        return;
      }
      // extra level of nesting is annoying, but it avoids having to instantiate the task resources immediately
      return function() {
        return spawn({
          name: filename, // full path
          task: options.command
        });
      };
    });
  }

  // 2nd: transforms


  return tasks;
};
