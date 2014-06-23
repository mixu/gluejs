var fs = require('fs'),
    os = require('os'),
    path = require('path'),
    util = require('util'),
    resolveOpts = require('../../util/resolve-opts.js'),
    Minilog = require('minilog'),
    log = Minilog('amd'),
    Task = require('minitask').Task,
    Cache = require('minitask').Cache,
    nodeResolve = require('resolve'),
    amdresolve = require('amd-resolve'),
    loadAMDConfig = require('../amd/load-config.js'),
    spawn = require('../../file-tasks/spawn.js'),

    // part 1: transform-runner
    transformRunner = require('transform-runner'),
    // part 2: packager
    amdPack = require('./index.js');

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
homePath = (typeof homePath === 'string' ? path.normalize(homePath) : process.cwd());

function API() {
  this.options = {
    remap: {},
    cache: true,
    'cache-path': homePath + path.sep + '.gluejs-cache' + path.sep,
    'cache-method': 'stat',
    include: [],
    log: 'warn',
    // set options here so that the cache hash does not change
    jobs: require('os').cpus().length * 2,
    // set this so that builds are invalidated as the version changes
    'gluejs-version': require('../../../package.json').version
  };

}

API.prototype._resolveOptions = function(input) {
  var opts = { };
  // copy each input key, overwrite later
  Object.keys(input).forEach(function(key) {
    opts[key] = input[key];
  });

  // if the cache is disabled, then use a temp path
  if (!input.cache) {
    opts['cache-path'] = os.tmpDir() + '/gluejs-' + new Date().getTime();
  }
  // first priority is to figure out what the base path is
  opts.basepath = resolveOpts.inferBasepath(input.basepath, input.include);

  // resolve paths relative to process.cwd
  ['list-files', 'out', 'vendor-base'].forEach(function(key) {
    if (input[key]) {
      opts[key] = path.resolve(process.cwd(), input[key]);
    }
  });

  // resolve paths relative to basepath
  ['config', 'vendor'].forEach(function(key) {
    if (input[key]) {
      opts[key] = path.resolve(opts.basepath, input[key]);
    }
  });

  opts.include = input.include.map(function(p) {
    return path.resolve(opts.basepath, p);
  });

  // next, figure out the main file
  opts.main = resolveOpts.inferMain(opts.basepath, opts.include);

  // load resources

  if (input.amd) {
    opts.amdresolve = loadAMDConfig(opts.config);
  }

  if (input.amd && opts.main) {
    // baseDir is required for AMD
    opts.amdresolve.baseDir = opts.basepath;
  }

  // resolve the vendor and plugin options

  var vendor = require(path.resolve(process.cwd(), input.vendor));

  opts.vendor = vendor;

  var vendorMap = vendor.paths;

  // resolve relative to --vendor-base
  Object.keys(vendorMap).forEach(function(name) {
    var value = vendorMap[name];
    if (typeof value === 'string' && value.charAt(0) == '.') {
      vendorMap[name] = path.resolve(input['vendor-base'], value);
    }
  });
  Object.keys(vendorMap).forEach(function(name) {
    var value = vendorMap[name];
    if (!fs.existsSync(value)) {
      vendorMap[name] = false;
    }
  });

  opts.vendorMap = vendorMap;

  // prefix: function(name, filepath) {}
  var plugins = {};

  function findModule(name) {
    var result = '';
    try {
      result = nodeResolve.sync(name, { basedir: process.cwd() });
    } catch (e) {
      try {
        result = nodeResolve.sync(name, { basedir: __dirname });
      } catch (e) {
        console.error('Cannot find module ' + name + ' from ' + process.cwd() + ' or ' + __dirname);
        throw e;
      }
    }
    return result;
  }

  Object.keys(input).forEach(function(name) {
    var matched = (typeof name === 'string' ? name.match(/plugin\-(.*)/) : false);
    if (matched) {
      var ext = matched[1];
      opts[name] = findModule(input[name]);
      plugins[ext] = require(opts[name]);
    }
  });
  opts.plugins = plugins;

  return opts;
};

API.prototype.render = function(out) {
  // resolve opts
  var self = this,
      opts = this._resolveOptions(this.options),
      cache = Cache.instance({
        method: opts['cache-method'],
        path: opts['cache-path']
      });

  // cache hash (only options which affect the build invalidation (at this level)
  var invalidationOpts = {};
  ['include', 'command', 'transform', 'exclude', 'ignore',
   'gluejs-version'].forEach(function(key) {
    invalidationOpts[key] = opts[key];
  });

  var nomin = opts.vendor.nomin || [];

  function resolvePackage(basepath, key) {
    if (key.charAt(0) == '.' || key.charAt(0) == '/') {
      return key;
    }
    var currOpts = opts.amdconfig || {};
    // override relDir for each file
    currOpts.relDir = basepath;
    try {
      return amdresolve.sync(key, currOpts);
    } catch(e) {
      log.warn('Could not resolve package: ', key, ' BP ', basepath);
      return key;
    }
  };

  function getPackageRoot(basepath, key) {
    if (amdresolve.isSpecial(key)) {
      return false;
    }
    var modulePath,
        stat;

    // 3rd party packages can either be resolved normally, or they can be in the vendor config thing
    if (opts.vendorMap[key]) {
      modulePath = opts.vendorMap[key];
    } else {
      modulePath = resolvePackage(basepath, key);
    }

    try {
      stat = fs.statSync(modulePath);
    } catch (e) {
      log.warn('Could not find target package root, setting package root to ', modulePath);
      return modulePath;
    }


    // for modules, exclude the root directory of the module (or just the plain file for single file
    // packages) to prevent it or any related files from being parsed

    if (stat.isDirectory()) {
      return modulePath;
    } else if (stat.isFile()) {
      return path.dirname(modulePath) + path.sep;
    }
  };

  var excludePaths = opts.vendor.exclude.map(function(str) {
    if (typeof str !== 'string' || str.charAt(0) == '/') {
      return str;
    } else if (str.charAt(0) == '.') {
      // resolve non-packages to their full paths
      return path.resolve(opts.basepath, str);
    }
    // exclude or ignore package => resolve package root folder and exclude it + subpath
    return getPackageRoot(opts.basepath, str);
  });

  // console.log(excludePaths);

  // read files using the runner
  // run any tasks and parse dependencies (mapper)
  var runner = transformRunner({
    // new API
    tasks: function(filename, done) {
      // Resolve tasks just prior to processing the file
      var tasks = [];

      // "simple mode": one --command which only applies to .js files
      if (opts.command && path.extname(filename) == '.js' && nomin.indexOf(filename) == -1) {
        tasks.push(function() {
          return spawn({
            name: filename, // full path
            task: opts.command
          });
        });
      }

      // check stat => Task does not work with nonexistent inputs
      if (!fs.existsSync(filename)) {
        return false;
      }

      // tasks empty? skip and produce a new tuple
      if (tasks.length === 0) {
        return false;
      }

      // add parse-result-and-update-deps task
      // Wrapping and final file size reporting are inherently serial (because they are
      // part of the join-into-single-file Reduce task)
      var task = new Task(tasks),
          cacheFile = cache.filepath();

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
    },

    cache: require('../../transform-runner/wrap-cache.js')(cache, cache.hash(JSON.stringify(invalidationOpts))),

    log: Minilog('runner'),

    // old
    include: opts.include,
    exclude: excludePaths,
    // when resolving, ignore excluded module names as well as the ones with known paths
    ignore: [].concat(opts.vendor.exclude, Object.keys(opts.vendor.paths)),
    jobs: opts.jobs,

    // amd
    'amd': true,
    'resolver-opts': {
      amdconfig: opts.amdresolve
    }

  });

  runner.once('done', function(err, files) {
    console.log('Processing ' + files.length + ' files.');

    amdPack({
      files: files,
      out: fs.createWriteStream(opts.out),
      basepath: opts.basepath,
      main: opts.main,
      cache: cache,

      // amd
      configjs: opts.amdresolve,
      vendor: opts.vendorMap,
      exclude: opts.vendor.exclude,
      extras: ['underscore'],
      command: opts.command,
      plugins: opts.plugins,

    }, function(err, processedFiles) {
      if (opts['list-files']) {
        fs.appendFileSync(opts['list-files'], processedFiles.join('\n'));
      }
      cache.end();
    });
  });
};

API.prototype.set = function(key, value) {
  var self = this;
  // Input can be:
  // 1) key-value pair object
  if (arguments.length == 1 && key === Object(key)) {
    // set the logging level first
    if (key['log']) {
      this.set('log', key['log']);
    }
    Object.keys(key).forEach(function(k) {
      self.set(k, key[k]);
    });
    return this;
  }

  // 2) primitive <= set or append depending on the original value
  // 3) array <= set or append depending on the original value

  if (key == 'log' && value) {

    if (process.stdout.isTTY) {
      Minilog.enable();
    } else {
      Minilog.pipe(Minilog.suggest).pipe(new Minilog.Stringifier()).pipe(process.stdout);
    }
    if (['info', 'warn', 'error'].indexOf(value) > -1) {
      // enable logging levels >= info
      Minilog.suggest.defaultResult = false;
      Minilog.suggest.clear().allow(/.*/, value);
    } else if (value === 'debug') {
      Minilog.suggest.defaultResult = true;
      Minilog.suggest.clear();
    }
  }

  if (Array.isArray(this.options[key])) {
    // 1) an array <= append to array
    if (Array.isArray(value)) {
      this.options[key] = this.options[key].concat(value);
    } else {
      this.options[key].push(value);
    }
  } else if (this.options[key] && typeof this.options[key] == 'object') {
    // 2) an object
    //   <= for two params, set key and value
    //   <= for an object param, iterate keys and values and set them
    // keyName, arg1, arg2
    if (arguments.length === 3) {
      this.options[key][arguments[1]] = arguments[2];
    } else if (arguments.length === 2 &&
      value && typeof value === 'object') {
      Object.keys(value).forEach(function(oKey) {
        self.options[key][oKey] = value[oKey];
      });
    } else {
      throw new Error('Unknown option format for key "' + key + '": ' +
        Array.prototype.slice.call(arguments));
    }
  } else {
    // 3) a primitive <= overwrite
    this.options[key] = value;
  }
  return this;
};

module.exports = API;
