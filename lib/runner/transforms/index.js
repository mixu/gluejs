var fs = require('fs'),
    path = require('path'),
    parallel = require('miniq'),
    Task = require('minitask').Task,
    microee = require('microee');

var getTasks = require('./get-tasks.js'),
    checkOptions = require('../../item-tasks/check-options.js'),
    filterNpm = require('../../item-tasks/filter-npm.js'),
    filterRegex = require('../../item-tasks/filter-regex.js'),
    detectiveDependencies = require('../../list/detective-dependencies.js');

var log = require('minilog')('mapper');

function RunQueue(opts) {
  checkOptions('RunQueue', opts, {
    required: {
      cache: 'Instance of minitask.cache',
      include: 'Array of files to process',
      jobs: 'Int, number of parallel jobs to run'
    },
    optional: {
      command: 'String, array of strings or array of commands',
      transform: 'String or array strings of transform modules',
      exclude: 'Array of regexps',
      ignore: 'Array of strings',
      'gluejs-version': 'Version key, used for cache invalidation'
    }
  });

  // options
  this.opts = opts;
  // cache
  this.cache = opts.cache;
  // cache hash (only options which affect the build invalidation (at this level)
  var invalidationOpts = {};
  ['include', 'command', 'transform', 'exclude', 'ignore',
   'gluejs-version' ].forEach(function(key) {
    invalidationOpts[key] = opts[key];
  });
  this.cacheHash = this.cache.hash(JSON.stringify(invalidationOpts));
  // list of input files that have already been seen
  this._seenFiles = [];
  // shared execution queue
  this._queue = parallel(opts.jobs);
  // result tuple storage
  this._results = [];

  // cache for detective-dependencies to avoid re-resolving known dependencies
  this.dependencyCache = {}

  // Exclude files using the npmjs defaults for file and path exclusions
  this.excludeChecks = [filterNpm];

  // If there are any default or user-defined excludes, apply them
  if (opts.exclude) {
    this.excludeChecks.push(function(filename) {
      return filterRegex(filename, opts.exclude);
    });
  }

  this.ignoreChecks = [];
  // if there are ignores, create a cache file to act as the placeholder item
  // for ignored files
  this.ignoreFile = '';
  this.ignore = false;
  if (opts.ignore) {
    this.ignore = opts.ignore;
    this.ignoreChecks.push(function(filename) {
      return opts.ignore.indexOf(filename) === -1;
    });
    this.ignoreFile = this.cache.filepath() + '.js';
    fs.writeFileSync(this.ignoreFile, 'module.exports = {};');
  }
}

microee.mixin(RunQueue);

// cache keys need to be generated based on the config hash to become a factor
// in the invalidation in addition to the file content
RunQueue.prototype.key = function(name) {
  return this.cacheHash + '-' + name;
};

// check the cache, return a tuple from the cache if already processed
RunQueue.prototype.hasCached = function(filename) {
  var cacheFile, rawDeps, resolvedDeps, renames;
  // cached stuff:
  // - an output file
  cacheFile = this.cache.file(filename).path(this.key('cacheFile'));
  // - a set of renamed deps
  rawDeps = this.cache.file(filename).data(this.key('rawDeps'));
  // - a set of normalized deps
  resolvedDeps = this.cache.file(filename).data(this.key('resolvedDeps'));
  // - a set of unnormalized deps
  renames = this.cache.file(filename).data(this.key('renames'));

  // all items must exist in the cache for this to match
  if (cacheFile && rawDeps && resolvedDeps && renames) {
    // caching should have the exact same effect as full exec
    // push the result and add resolvedDeps
    this.addResult(filename, cacheFile, rawDeps, resolvedDeps, renames);
    return true;
  }
  return false;
};

RunQueue.prototype.add = function(filename) {
  var self = this,
      opts = this.opts;

  // input can be an array of paths
  if (Array.isArray(filename)) {
    filename.forEach(function(filename) {
      self.add(filename);
    });
    return;
  }

  // check that the file has not already been queued
  if (this._seenFiles.indexOf(filename) != -1) {
    return;
  }
  this._seenFiles.push(filename);
  // check that the file does not exist in cache
  if (self.hasCached(filename)) {
    this.emit('add', filename);
    this.emit('hit', filename);
    return;
  }
  // Apply exclusions
  var isExcluded = this.excludeChecks.some(function(fn) {
    // filter-style: return true to include, false to exclude
    return !fn(filename);
  });
  if (isExcluded) {
    log.info('File excluded', filename);
    return;
  }

  this.emit('add', filename);
  log.info('Add', filename);

  // Apply --ignore's
  if (this.ignore) {
    var isIgnored = this.ignoreChecks.some(function(fn) {
      // filter-style: return true to include, false to exclude
      return !fn(filename);
    });
    if (isIgnored){
      log.info('File ignored', filename);
      // no need to parse the file since it's always an empty file
      this.addResult(filename, self.ignoreFile, [], [], []);
      // queue has been updated, finish this task
      this.emit('miss', filename);
      return;
    }
  }

  // add to queue (and run)
  this._queue.exec([
    function(done) {
      // Resolve tasks just prior to processing the file
      var tasks = (path.extname(filename) != '.json' ? getTasks(filename, opts) : []);

      // console.log(filename, getTasks(filename, opts), opts.command);

      // tasks empty? skip and produce a new tuple
      if (tasks.length === 0) {
        // cache the output file: in this case, it'll be a direct reference to
        // the file itself
        self.cache.file(filename).path(self.key('cacheFile'), filename);

        // run the parse-and-update-deps task
        return self.parseAndUpdateDeps(filename, filename, done);
      }

      // add parse-result-and-update-deps task
      // Wrapping and final file size reporting are inherently serial (because they are
      // part of the join-into-single-file Reduce task)
      var task = new Task(tasks);

      var cacheFile = self.cache.filepath();

      task.once('done', function() {
        // console.log('task done', tasks, filename, '=>', cacheFile);
        // console.log(cacheFile, fs.readFileSync(cacheFile).toString());

        // cache the output file name
        self.cache.file(filename).path(self.key('cacheFile'), cacheFile);

        // at the end, the result file has to be parsed
        // 1) the real cache file must be piped in
        // 2) but the dependency resolution itself must be done using the
        // original location!
        self.parseAndUpdateDeps(filename, cacheFile, done);
      });

      task.input(fs.createReadStream(filename))
          .output(fs.createWriteStream(cacheFile))
          .exec();
    }]);
};

RunQueue.prototype.parseAndUpdateDeps = function(filename, cacheFile, done) {
  var self = this;
  detectiveDependencies(filename, cacheFile, this.opts.ignore, this.dependencyCache,
    function(err, rawDeps, resolvedDeps, renames) {
    // do not store result when an error occurs
    if (!err) {
      // log.debug('Cache parse result:', filename);
      // store the dependencies
      self.cache.file(filename).data(self.key('rawDeps'), rawDeps);
      // store the normalized dependencies
      self.cache.file(filename).data(self.key('resolvedDeps'), resolvedDeps);
      // store the renamed dependencies
      self.cache.file(filename).data(self.key('renames'), renames);
    } else {
      log.debug('Skipping cache due to errors:', filename);
      (Array.isArray(err) ? err : [ err ]).forEach(function(err) {
        self.emit('parse-error', err);
      });
    }
    self.addResult(filename, cacheFile, rawDeps, resolvedDeps, renames);
    // queue has been updated, finish this task
    self.emit('miss', filename);
    done();
  });
};

RunQueue.prototype.addResult = function(filename, cacheFile, rawDeps, resolvedDeps, renames) {
  var self = this;
  this._results.push({
    filename: filename,
    content: cacheFile,
    rawDeps: rawDeps,
    deps: resolvedDeps,
    renames: renames
  });
  // add deps to the queue -> this also queues further tasks
  resolvedDeps.filter(function(dep) {
    // since deps may contain references to external modules, ensure that the items start with
    // . or /
    return dep.charAt(0) == '/' || dep.charAt(0) == '.';
  }).forEach(function(dep) {
    self.add(dep);
  });
};

RunQueue.prototype.exec = function(onDone) {
  var self = this;
  if (onDone) {
    this._queue.once('empty', function() {
      // always sort results for consistency and easy testing
      self._results.sort(function(a, b) {
        return a.filename.localeCompare(b.filename);
      });
      self.emit('done');
      onDone(null, self._results);
    });
  }
};

module.exports = function(opts, onDone) {
  // Initialize queue
  var runner = new RunQueue(opts);

  process.nextTick(function() {
    function resolveDir(dirname) {
      // if the input is a directory, add all files in it, but do not add further directories
      var basepath = dirname + (dirname[dirname.length - 1] !== path.sep ? path.sep : ''),
          paths = fs.readdirSync(basepath).map(function(f) {
            return basepath + f;
          });
      paths.map(function(filepath) {
        // console.log('rd', item);
        var stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
          // Skip `node_modules` folders when they occur in the subdirectories of
          // the initial set of includes
          if (path.basename(filepath) != 'node_modules') {
            resolveDir(filepath);
          }
        } else {
          runner.add(filepath);
        }
      });
    }

    // input may be a directory - but only the initially included items
    (Array.isArray(opts.include) ? opts.include : [ opts.include ]).forEach(function(filepath) {
      // console.log('initial', filename);
      var stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        resolveDir(filepath);
      } else {
        runner.add(filepath);
      };
    });
    // start the queue
    runner.exec(onDone);
  });
  return runner;
};
