
function (opts, dest) {

  // set up the final stream
  // - function or stream (fs / http)

  // start the cache

  // instantiate the pipeline

  // resolve globs and write to the pipeline

  // - sort
  // - generate etag
  //    - if match, kill the target stream

  // Read from the pipeline and decide what to do with the result.
  // -> build was cached: stream from cache
  // -> http + etag match: stream from cache
  // -> else: stream to cache and destination


  // + append:
  // - add conversion to toDeps
  // - add browser-pack
  // - add cache writer (split)



}





API.prototype.render = function(dest) {
  var self = this,
      expectedEndEvents = 1,
      seenEndEvents = 0,
      opts = this._resolveOptions(this.options),
      cache = Cache.instance({
        method: opts['cache-method'],
        path: opts['cache-path']
      });

  log.info('Build options', opts);

  function onErr(err) {
    if (err) {
      self.emit('error', err);
      cache.end();
    }
  }

  // create a stream capturer if we want the result as callback result
  if (typeof dest == 'function') {
    dest = new Capture().wrap(dest);
  }

  // set up the onDone tasks on the destination stream
  var onDestEnd = runOnce(function() {
    cache.end();
    if (++seenEndEvents == expectedEndEvents) {
      self.emit('done');
    }
  });
  dest.once('finish', onDestEnd)
      .once('close', onDestEnd)
      .once('error', onErr);

  // Skip the whole build if: 1) no files have changed and 2) the etag matches
  if (opts.clean && opts.etag && this._streamEtag(opts.etag, dest)) {
    return;
  }

  cache.begin();

  // cache hash (only options which affect the build invalidation (at this level)
  var invalidationOpts = {};
  ['include', 'command', 'transform', 'exclude', 'ignore',
   'gluejs-version'].forEach(function(key) {
    invalidationOpts[key] = opts[key];
  });

  // run any tasks and parse dependencies (mapper)
  var runner = runTasks({
    // new API
    tasks: require('./lib/transform-runner/get-tasks.js')({
      cache: cache,
      command: opts.command,
      'global-command': opts['global-command'],
      transform: opts.transform,
      'global-transform': opts['global-transform'],
      basepath: opts.basepath
    }),

    cache: require('./lib/transform-runner/wrap-cache.js')(cache, cache.hash(JSON.stringify(invalidationOpts))),

    log: Minilog('runner'),

    // old
    include: opts.include,
    exclude: opts.exclude,
    ignore: opts.ignore,
    jobs: opts.jobs
  });
  // parse errors should not be considered errors - they will stop the
  // middleware from producing output
  runner.on('parse-error', function(err) {
    self.emit('warn', err);
  });
  runner.on('file', function(filename) {
    self.emit('file', filename);
  });
  runner.on('hit', function(filename) {
    self.emit('hit', filename);
  });
  runner.on('miss', function(filename) {
    self.emit('miss', filename);
  });

  if (opts.log === 'debug') {
    runner.on('file-done', function(filename, result) {
      log.info('Result:', filename, result);
    });
  }

  if (opts.progress) {
    require('./lib/reporters/progress.js')(runner);
  }
  if (opts.report) {
    require('./lib/reporters/size.js')(runner);
  }

  runner.once('done', function(err, files) {
    if (err) {
      return onErr(err);
    }

    // best ensure that the files are in sorted order
    files.sort(function(a, b) { return a.filename.localeCompare(b.filename); });

    if (opts.list) {
      files
        .map(function(file) { return file.filename; })
        .forEach(function(name) { console.error(name); }); // log to stderr
    }

    // calculate a etag for the result
    // this should be invalidated if:
    // - the set of files changes
    // - the size of any of the files changes
    // - the date modified of any of the files changes
    // - any of the build options change
    var config = [
          'basepath', 'command', 'exclude', 'export',
          'gluejs-version', 'ignore', 'include', 'main',
          'remap', 'source-map', 'transform', 'umd'
        ].reduce(function(prev, key) {
          prev[key] = opts[key];
          return prev;
        }, {}),
        cacheStr = JSON.stringify(config);

    files.forEach(function(file, index) {
      cacheStr += file.filename + '-' + cache.file(file.filename).sig() + '\n';
    });
    var etag = 'W/' + Cache.hash(cacheStr),
        hadError = false;

    // is `dest` not set? => used to skip the latter half of the build, for heating up the
    // cache when using a file watcher
    // OR: does a final build result with this etag exist?
    if (!dest || self._streamEtag(etag, dest)) {
      return;
    }
    // must emit before the destination stream/request has closed
    // could be moved somewhere better
    self.emit('etag', etag);

    self.once('error', function() {
      hadError = true;
    });

    expectedEndEvents++;

    config.files = files;
    config.out = cacheSplitter(cache.filepath(), dest, function(err, cacheFile) {
      // finalize the cached result if there were no errors
      if (!hadError) {
        cache.data('etag-' + etag, cacheFile);
        log.debug('Cached etag:', etag, cacheFile);
      } else {
        log.debug('Skipped etag:', etag, 'due to error.');
      }
      if (++seenEndEvents == expectedEndEvents) {
        self.emit('done');
      }
    });

    packageCommonJs(config);
  });
  // start the queue
  runner.exec();
};
