var fs = require('fs'),
    path = require('path'),
    Task = require('minitask').Task,
    spawn = require('../file-tasks/spawn.js');

function commandsToTasks(commands) {
  var tasks = [],
      isStringArray = commands.every(function(item) { return typeof item === 'string'; }),
      isFnArray = commands.every(function(item) { return typeof item === 'function'; });

  if (isStringArray) {
    // --command strings do not run on non-JS files,
    // this is because 1) of backwards compat and 2) the spawn task failing badly
    if (path.extname(filename) == '.js') {
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
    tasks = commands.map(function(wrapper) {
      return wrapper(filename);
    }).filter(Boolean);
  } else {
    throw new Error('Unknown --command format.');
  }
  return tasks;
}

function transformsToTasks(transforms) {
  var tasks = [];
  transforms.forEach(function(transform) {
    var nodeResolve = require('resolve'),
        modulePath, mod;

    // try from process.cwd()
    try {
      modulePath = nodeResolve.sync(transform, { basedir: process.cwd() });
      mod = require(modulePath);
    } catch (e) {
      // try from current directory (e.g. global modules)
      try {
        modulePath = nodeResolve.sync(transform, { basedir: __dirname });
        mod = require(modulePath);
      } catch (e2) {
        throw e; // throw the friendlier error
      }
    }

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
  return tasks;
}

function asArray(item) {
  return (Array.isArray(item) ? item : [ item ]);
}

function getTasks(filename, opts) {
  // Tasks should not create any resources until unwrapped
  // [
  //    function() { return syncFn | asyncFn | spawn | duplex stream; };
  // ]
  var tasks = [],
      relativeParts = path.relative(opts.basepath, filename).split(path.sep),
      isInSubDir = relativeParts.indexOf('..') > -1,
      isInNodeModule = relativeParts.indexOf('node_modules') > -1,
      isMain = isInSubDir && !isInNodeModule;
  // transforms and commands can be targeted in the following ways:
  // - isMain: whether a file is in a subdirectory of the base path, and the path does not
  //   include a "node_modules" segment. Regular --transform and --command items are only
  //   applied to files in the main package.
  // - TODO: per-package transforms via the relevant package.json field

  if (isMain && opts.command) {
    tasks.concat(commandsToTasks(asArray(opts.command)));
  }
  if (isMain && opts.transform) {
    tasks.concat(transformsToTasks(asArray(opts.transform)));
  }
  if (opts['global-command']) {
    tasks.concat(commandsToTasks(asArray(opts['global-command'])));
  }
  if (opts['global-transform']) {
   tasks.concat(transformsToTasks(asArray(opts['global-transform'])));
  }

  return tasks.filter(Boolean);
}

module.exports = function(opts) {
  return function(filename, done) {
    // Resolve tasks just prior to processing the file
    var tasks = (path.extname(filename) != '.json' ? getTasks(filename, {
      command: opts.command,
      transform: opts.transform
    }) : []);

    // tasks empty? skip and produce a new tuple
    if (tasks.length === 0) {
      return false;
    }

    // add parse-result-and-update-deps task
    // Wrapping and final file size reporting are inherently serial (because they are
    // part of the join-into-single-file Reduce task)
    var task = new Task(tasks),
        cacheFile = opts.cache.filepath();

    task.once('done', function() {
      done(null, cacheFile);
    });
    task.once('error', function(err) {
      done(err);
    });

    task.input(fs.createReadStream(filename))
        .output(fs.createWriteStream(cacheFile))
        .exec();

    return true;
  };
};
