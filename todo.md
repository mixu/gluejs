# Todo

- Refactor the `expr` and `ext` thing into something that just has '.test()'
- test robustness against getting killed or having cache metadata become corrupted
- add `cache clean`
- test multiple `--command`

## What's new in v2.1

gluejs v2.1 adds significant performance improvements over v2.0.x! In addition, it adds support for custom transformations, including ones that were written for browserify.

- the task execution engine now supports running multiple tasks concurrently while producing a single output file. Most build systems only use a single output stream, which means that expensive tasks such as `uglifyjs` are run on each file in serial order. gluejs v2.1's new engine executes all tasks in parallel, kind of like MapReduce at a small scale (configurable via `--jobs`).
- anecdotally, this has reduced build time for CPU-intensive builds (e.g. minifying a large number of files) by ~50% by making use of all the available CPU cores.
- the system now enables caching by default; if you run the same gluejs task twice, only the changed files are re-processed. Changes are detected either using md5 hashing or filesize + modification time. Caching used to be an advanced option, but it helps a lot in practice so I figured I'd enable it by default. You can opt out via `--no-cache`, but why?
- the cache supports multiple versions of the same input file (e.g. if you have a gluejs task for a debug build and a production build, switching between the two no longer invalidates the cache).
- added support for custom transformations, such as compiling template files and other compile-to-JS files.

## --command

`--command <cmd>` / `.set('command', <cmd>)`: Pipe each file through a shell command and capture the output. For example:

    --command "uglifyjs --no-copyright"

For more complicated use cases, you'll probably want to use `--transform`.

## --transform (v2.1)

`--transform <module>`: activates a source transformation module. This enables 3rd party extensions for things that are more complex than just piping through via `--command`.  API-compatible with browserify's source transformation modules.

For example:

    npm install coffeeify
    gluejs --transform coffeeify --include main.coffee > bundle.js

gluejs uses [minitask](https://github.com/mixu/minitask) internally, so you can also write modules that return sync / async functions, Node core duplex / transform streams or Node core child_process objects.

## --jobs (v2.1)

`--jobs <n>` / `.set('jobs', <n>)`: Sets the maximum level of parallelism for the task execution pipeline. Default: `os.cpus().length * 2`.

## --cache

`--cache <path>` / `.set('cache', <path>)`: Use a specific directory for caching. This is a directory where the results of the previous builds are stored along with metadata. Caching is enabled by default in v2.1. If a path is not set, then `~/.gluejs-cache` is used for storing cache results. You can just delete the directory to invalidate the cache.

The cache speeds up large builds (and minified builds) significantly since only source files that have changed are updated.

Use a directory with a dot in front to hide the cached files (remember to also gitignore the directory). The path is relative to the working directory. For example:

    --cache .cache

When the cache is in use, the number of cache hits are shown:

    Cache hits: 2 / 2 files

To get even more info, enable `--verbose`.

## --cache-clean (v2.1)

`--cache-clean`: Clears the global cache folder by deleting it. This is always done before processing anything else.

## --cache-method (v2.1)

`--cache-method <stat|md5|sha512>`: Sets the cache invalidation method. `stat` uses the file size and last modified date of the input file. `md5` (and other hash algorithms supported by `crypto.createHash`) uses hashes to verify that the input file has not changed. Default: stat.

## --no-cache (v2.1)

`--no-cache` / `.set('cache', false)`: Disables the cache; sets the cache directory to a temporary directory.

## Writing transform modules

By default, gluejs only handles files that end with ".js".

You can create custom handlers that handle other types of files, such as templates for your favorite templating language.


# Known issues

- setting basepath to ./node_modules/foo causes the root to be empty rather than being based inside the package directory. E.g. you need to do require('foo') to get the result rather than require('./index.js');
- replace('foo', 'window.foo') applies to all subdependencies indiscriminately. Need a better syntax to control this. Old behavior was to only replace top level dependencies.

## --watch

TODO

Watch files for changes

.watch(function(err, text){ ...}): renders and adds file watchers on the files.

Note that this API is a bit clunky:

there is no way to unwatch a file other than terminate the program
on each watched file change, a console.log() message is shown
the API uses fs.watchFile(), so you do not get notification of newly added files in directories; watches are registered on the files that were used on the first render
But it works fine for automatically rebuilding e.g. when doing development locally.

## --transform

TODO

Compiling template files and compile-to-JS files.

By default, gluejs only handles files that end with ".js".

You can create custom handlers that handle other types of files, such as templates for your favorite templating language.

To specify a handler, call `handler(regexp, function(opts, done) { ... })`

Here is an example:

```javascript
var Template = require('templating-library');
var extensionRe = new RegExp('(.+)\\.tpl$');
new Glue()
  .include('./fixtures/mixed_content/')
  .handler(extensionRe, function(opts, done) {
    var wrap = opts.wrap, filename = opts.filename;
    var out = Template.precompile(
      fs.readFileSync(filename).toString()
    );
    done(filename.replace(extensionRe, '$1.js'), out);
  })
  .render(function(err, txt) {
    console.log(txt);
    done();
  });
```

In fact, internally, the ".js" extension handler is just:

```javascript
.handler(new RegExp('.*\.js$'), function(opts, done) {
  return done(opts.filename, fs.readFileSync(opts.filename, 'utf8'));
});
```

Handler params:

- first param (regexp): the regexp used to match files.
- second param (callback): a callback(options, done) which will be called for each file.

The callback params:

- first param (options): has the following elements
  - filename: the full path to the file
  - relativeFilename: the file name relative to the gluejs basepath
- second param (done): a callback(string) which should be called with the return value - this allows for async calls inside the handler.

# Tasks

- pre-filters for .git / svn / hg / cvs directories for better performance
- attach the stat information during the tree traversal to avoid double stats
- better metadata fetching from package.json
  - it should be possible to pre-filter the packages (before infer packages),
    so that devDependencies are not included in the processing
  - version numbers should be fetched
- ability to remap paths
  - e.g. add a file to the root from outside the root, with a different virtual filename
  - e.g. swap out the content a directory for the content of another one (shimming)

# Evaluation

- Convert JSON: needs documentation
- Convert templates: needs examples + documentation + pluggability
- Optimal bundling:
  - UMD bundle support **
  - empirically based packaging / dynamic loading **
- Generate obfuscated code server side **
- Source maps support
- Fix issues with interrupted cached data
- Caching support for different options
- Remapping cross environment dependencies / dependency injection
- Mocking out dependencies during testing/runtime **
- RequireJS to CommonJS conversion
- Easier conventions for adding a module both on the client and server side, e.g. only a node_modules entry => client side

# Internals

Phases:

- acquire file paths (e.g. via calls to .include and .npm)
    => result is a tree { files: [] } (under basepath)
    => note that nothing is excluded here
- filter file paths (e.g. remove excluded, remove .npmignore and so on)
- attach tasks
- run tasks
- squash result (or save to a directory)

File tasks:

- run-shell (e.g. run uglify)
- wrap-commonjs-web (e.g. wrap inside a function call)
- wrap-commonjs-web-sourceurl
- wrap-commonjs-amd (e.g. take commonJS files, resolve their direct dependencies, wrap into an AMD module)
- wrap-amd-commonjs-web (e.g. take a AMD file, look at the dependency declaration, convert that to a string, wrap into a web-commonjs module)


Final tasks:

- concatenate
- static-server (e.g. serve over http)
- package-commonjs (to any writable stream)

New features:

- vastly better conventions and support for writing dual-platform (browser + server) code that has some functions replaced with platform-specific equivalents
- Mocha test server and conventions to make it easy to repackage and run your Mocha tests inside a browser
- static file serving and Connect middleware
- better AMD interoperability: hook into AMD if that's the system being used; optionally export a `require()` implementation

Minor, but cool features:

- interoperate with libraries that use globals by binding variables under window.*
- continous rebuild via watcher
- build non-JS resources, for example compile Jade and Handlebars templates
- sourceURL support
- custom build task support
- better support for .npmignore files and filtering in general
- choice between throwing, or returning undefined in the require shim

# How do I ...?

## How do I build a single package from a existing Node.js project?

The easiest way is to use the command line tool:

    gluejs --out dist/radar_client.js

This auto-detects the package name and main file, and bundles the content of the current directory and subdirectories as well as any npm modules in them.

You can override this by explictly passing in various options - for example, if you only want to include the content of a single directory.

## How do I integrate gluejs with my web app so that things are built automatically?

You can use the API - and there is builtin Connect middleware if you're using Connect.

## How do I package tests for the browser?

There is a builtin Mocha test server task, which takes a set of tests as input and creates a server specifically for running one or more tests.

If you're not using Mocha, you can still use the API to create a package and serve it (with test-framework wrapping).

## How do I write dual-platform (browser + server) code using gluejs?

You have probably already been targeting both platforms - by writing code that can run in either environment. However, this is just one part of dual-platform coding.

Let me expand your horizon. All code falls into three categories:

- Code that works anywhere
- Code that is native on one platform, and needs to be shimmed / emulated / translated into remote procedure calls on the other
- Code that can only run on one platform

You've been writing code that works anywhere: where you explicitly avoid using API's that are not cross platform, or where you use 3rd party modules to hide the native APIs.

The second category: code that is native to one platform (node / browser), and shimmed on the other is what gluejs v2's conventions are targeting. This is the basic idea:

- Think of a single file (module) as a set of exports. The core file needs to be code that works anywhere - for example, data validation code in a Model usually doesn't depend on any external native APIs.
- Take the second category code - code that is native on one platform and shimmed on another - and split it into it's own file. Now have that file require the reusable core, and extend that core.

Here is an example core file `./lib/common/user.js`:

    function User(age) { this.age = age; }

    User.prototype.validate = function() {
      return this.age < 200 && this.age > 0;
    };

    module.exports = User;

and a shim file that extends that core `./lib/user.js`:

    var fs = require('fs'),
        User = require('./common/user.js');

    User.prototype.save = function() {
      fs.writeFileSync('~/userdata.js', JSON.stringify({ age: this.age }));
    };

    module.exports = User;



