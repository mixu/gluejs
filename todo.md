# What's new in v2.next

gluejs v2.next adds optional dependency parsing support:

- Passing `--parse` enables dependency parsing, which can figure out the full dependency graph given just a single entry point. More accurate exclusions may result in smaller output size but come with a performance cost. Note that parsing dependencies is slow (e.g. the performance is closer to browserify's performance).
- The caching system has been significantly improved, with some minor performance gains and reduced file handle usage.
- The [browser field](https://gist.github.com/defunctzombie/4339901) in package.json files is supported via [browser-resolve](https://github.com/defunctzombie/node-browser-resolve)

-----

# Todo

- Parse:
  - add support for parsing directory --include arguments
  - disable the automatic excludes like `/dist/` because they mess with things like jquery
  - transform and command options: parse the resulting file for dependencies
  - direct file requires like `require('jade/runtime')` should resolve correctly


// calculate a hash for the full list of files
// this can be used to validate etags
// it is based on the paths, mtimes and sizes of all files (sorted)
// plus the current set of options passed through a MD5 hash
// if it matches, just return the cached resource

- add `cache clean`
- improve the autodetection code so that people don't need to supply a --main argument in default cases (e.g. when there is a index.js or there is just one file in the package)

## use detective and amdetective

Steps:

- implement `--compare`: compares the trees from using the detective strategy vs the default strategy
- apply compatibility fixes:
  - allow including directories using the detective strategy
- apply later stage optimizations:
  - minimize the list of --replace shimmed modules in each package output based on the real set of dependencies from all files within that package
  - add core module shimming support
  - add support for replacing modules with other files (parsed)
  - add support for excluding dependents of a module
- amd:
  - config.js loading
  - better resolve error reporting
  - resolve value overrides
  - use the almond shim (?). Alternative is to just output a bundle of define()s

Benefits

- provides more accurate exclusion information (e.g. modules not connected from the main file can be ignored; files like package.json can often be safely excluded)
- allows the user to only specify `--main` without any includes
- allows us to auto-detect node_modules dependencies without explicit include management (making live reload possible / nice)
- paves way for efficient node core module support

Test cases:

- browser field in package.json remaps a file to a differently named file
- browser field in package.json remaps a module to a file
- exclude unused file like package.json
- include unmentioned file
- include unmentioned module
- apply .npmignore last
- perf test: load large directory a couple of hundred times and ensure caching works

## Production / dev

- allow using the same code paths for production and dev
- use a specific staging area folder
  - in dev, check the upstream folders for changes
  - in production, simply serve the staging area contents

## Inclusion optimization

- Allow coercion of dependencies (e.g. backbone with underscore + plain underscore => one of each):
  - `--dedupe-modules` should use package.json data to reduce duplication
  - `--dedupe-force modulename` should force only a single instance of a module, in spite of conflicting package.json data

## Tiny module optimizations

- add support for fully static resolution: given the full set of require() call dependencies, convert them into static lookups

## Implicit global support

- can detect naively via regex

## Docs todo

- need a good example of applying a transformation via the API
- need a good example of using a transformation with the Express middleware
- local dev server example post detective support
- document the grunt task options that are available
- Express middleware dev config example (e.g. if(DEV) { build() } else { express.static('..'); }
- Using libraries with globals such as jQuery and underscore (and/or how to use --replace with big libs for greater efficiency)
  - how --replace works in this case
  - how cascading works when the desired target is a global var
  - how cascading works when the desired target is a require() function
  - how cascading works when the desired target is AMD
- Making use of --amd with RequireJS

## --cache-clean

TODO

`--cache-clean`: Clears the global cache folder by deleting it. This is always done before processing anything else.

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

# Tasks

- A better big lib handing system (e.g. --external backbone --external underscore)
- Etags support for build results (e.g. shortcutting repeated loads even further)
- return a meaningful result from middleware if an error occurs
  (e.g. either a status code or perhaps even a div-printing thing)
- better metadata fetching from package.json
  - it should be possible to pre-filter the packages (before infer packages),
    so that devDependencies are not included in the processing
  - version numbers should be fetched
- ability to remap paths
  - e.g. add a file to the root from outside the root, with a different virtual filename
  - e.g. swap out the content a directory for the content of another one (shimming)

# Evaluation

- empirically based packaging / dynamic loading **
- Source maps support
- Fix issues with interrupted cached data
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



