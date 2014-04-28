var path = require('path');

var spawn = require('../../file-tasks/spawn.js');

module.exports = function(filename, options) {
  var tasks = [];
  // 1st: any custom commands (in array order)

  if (options.command) {
    var commands = (Array.isArray(options.command) ? options.command : [ options.command ]);
    // 1) array of strings
    var isStringArray = commands.every(function(item) {
      return typeof item === 'string';
    });
    // 2) array of functions
    var isFnArray = commands.every(function(item) {
      return typeof item === 'function';
    });

    if (isStringArray) {
      if (path.extname(filename) != '.json') {
        commands.forEach(function(command) {
          tasks.push(function() {
            return spawn({
              name: filename, // full path
              task: command
            });
          });
        });
      }
    } else if (isFnArray) {
      // evaluate the tasks: function(filename) {
      // return one of:
      //    false
      //    function() { return DuplexStream; }
      //    function(inputStr) { return outputStr; }
      //    function(inputStr, done) { done(outputStr); }
      //    function() { return { input: WritableStream, output: ReadableStream }; }
      tasks = options.command.map(function(wrapper) {
        return wrapper(filename);
      }).filter(Boolean);
    } else {
      throw new Error('Unknown --command format.');
    }
  }

  // 2nd: transforms
  if (options['transform']) {
    var transforms = (Array.isArray(options['transform']) ? options['transform'] :
      [ options['transform'] ]);
    transforms.forEach(function(transform) {
      var nodeResolve = require('resolve'),
          modulePath = nodeResolve.sync(transform, { basedir: process.cwd() }),
          mod = require(modulePath);

      if (mod.gluejs) {
        // if the module exports '.gluejs = true' (hacky) then we'll assume it's a gluejs module,
        // that means it should accept function(filename, package) { } and
        // return false or a Minitask-compatible task.
        tasks.push(mod);
      } else {
        // otherwise, assume it's a browserify module
        // the problem with those is that browserify assumes it's safe to instantiate all
        // resources (e.g. file handles) immediately. That doesn't work when you queue
        // up work early on like gluejs does, so we wrap the module in an additional function.
        // This also prevents us from doing useful pre filtering so these are applied on all files
        // (since the match is done after calling the function in browserify and in browserify,
        // you return a plain through-stream to indicate a no-op).

        tasks.push(
          function() {
            // wrapper fn (called only when the task is actually executed to pre-allocating file handles)
            return mod(filename);
          }
        );
      }
    });
  }


  return tasks;
};
