var path = require('path');

var spawn = require('../../file-tasks/spawn.js'),
    streamSize = require('../../file-tasks/stream-size.js'),
    wrapCommonJs = require('../../file-tasks/wrap-commonjs-web.js'),
    wrapJson = require('../../file-tasks/wrap-json-web.js');

module.exports = function(options) {
  var result = [],
      noBrowserify = true;

  // 1st: any custom commands (in array order)
  // 2nd: any wrapping
  // 3rd: any reporting

  // the expected result is one of (sync(input), async(input, done), fn() { return stream | child process } )
  // getFileTasks will call the function once with the item as the param
  // --> TODO in the future might want to just combine these two as the syntax is a bit awkward

  if (Array.isArray(options.command)) {
    var isObjectArray = options.command.every(function(item) {
      return typeof item === 'function';
    });

    if(isObjectArray) {
      result = options.command;
    } else {
      // basically, an array of strings
      throw new Error('Unknown --command format.');
    }
  } else if(options.command) {
    // "simple mode": one --command which only applies to .js files
    result.push(function(filename) {
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

  var exportVariableName = options['export'] || 'foo';

  // transforms
  // Maybe this should not be global? not sure, need feedback.
  if(options['transform']) {
    var nodeResolve = require('resolve'),
        modulePath = nodeResolve.sync(options['transform'], { basedir: process.cwd() }),
        mod = require(modulePath);

    if(mod.gluejs) {
      // if the module exports '.gluejs = true' (hacky) then we'll assume it's a gluejs module,
      // that means it should accept function(filename, package) { } and
      // return false or a Minitask-compatible task.
      result.push(mod);
    } else {
      // otherwise, assume it's a browserify module
      // the problem with those is that browserify assumes it's safe to instantiate all
      // resources (e.g. file handles) immediately. That doesn't work when you queue
      // up work early on like gluejs does, so we wrap the module in an additional function.
      // This also prevents us from doing useful pre filtering so these are applied on all files
      // (since the match is done after calling the function in browserify and in browserify,
      // you return a plain through-stream to indicate a no-op).

      result.push(
        function(filename, pkg) {
          // filter (return false to skip this task)
          return function() {
            // wrapper fn (called only when the task is actually executed to pre-allocating file handles)
            return mod(filename);
          };
        }
      );
    }
    noBrowserify = false;
    // push a "wildcard exports" wrapper since the browserify stuff applies to all files
    result.push(function(filename, packageObj) {
      if(path.extname(filename) == '.json') {
        return;
      }
      var relname = path.relative(packageObj.basepath, filename);
      return function() {
        return wrapCommonJs({
          'source-url': options['source-url'],
          'name': (packageObj.name ? exportVariableName+'/' + packageObj.name + '/' : exportVariableName+'/')  + relname
        });
      };
    });
  }

  if (noBrowserify) {
    // default task for wrapping .js
    result.push(function(filename, packageObj) {
      if(path.extname(filename) != '.js') {
        return;
      }
      var relname = path.relative(packageObj.basepath, filename);
      return function() {
        return wrapCommonJs({
          'source-url': options['source-url'],
          'name': (packageObj.name ? exportVariableName+'/' + packageObj.name + '/' : exportVariableName+'/')  + relname
        });
      };
    });
  }
  // default task for wrapping .json
  result.push(function(filename) {
    if(path.extname(filename) != '.json') {
      return;
    }
    return function() {
      return wrapJson({ });
    };
  });
  // if we are reporting, add the stream size capture task at the end
  // so we can report on results (e.g. of minification)
  if (options.report) {
    result.push(function(filename, packageObj) {
      if(path.extname(filename) != '.js') {
        return;
      }
      return streamSize({
        onDone: function(size) {
            var match = packageObj.files.some(function(file, i) {
              var result = (file.name == filename);
              if(result) {
                packageObj.files[i].sizeAfter = size;
              }
              return result;
            });
            if(!match) {
              throw new Error('File not found by index: ' + filename);
            }
        }
      });
    });
  }
  return result;
};
