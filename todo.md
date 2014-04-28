# What's new in v2.next

gluejs v2.next adds optional dependency parsing support:

- Passing `--parse` enables dependency parsing, which can figure out the full dependency graph given just a single entry point. More accurate exclusions may result in smaller output size but come with a performance cost. Note that parsing dependencies is slow (e.g. the performance is closer to browserify's performance).
- The caching system has been significantly improved, with some minor performance gains and reduced file handle usage.
- The [browser field](https://gist.github.com/defunctzombie/4339901) in package.json files is supported via [browser-resolve](https://github.com/defunctzombie/node-browser-resolve)

-----

# Todo

- Parse:
  - disable the automatic excludes like `/dist/` because they mess with things like jquery
  - transform and command options: parse the resulting file for dependencies
  - direct file requires like `require('jade/runtime')` should resolve correctly
- get rid of the two different ways of substituting a module, only use remap for substituting a module which will only be loaded when requested rather than immediately
- warn for unfulfilled requires

- Test against parse errors causing issues, such as caching the incorrect set of dependencies.
- Return proper error messages for parse errors when using the middleware

// calculate a hash for the full list of files
// this can be used to validate etags
// it is based on the paths, mtimes and sizes of all files (sorted)
// plus the current set of options passed through a MD5 hash
// if it matches, just return the cached resource

- add `cache clean`
- improve the autodetection code so that people don't need to supply a --main argument in default cases (e.g. when there is a index.js or there is just one file in the package)

## More features

- implement `--compare`: compares the trees from using the detective strategy vs the default strategy

### Better externals

*Better externals handling*: Sometimes you want to have granular control over what external modules are included in your build. The following options let you do that:

`--external <name>`: specifies that that module should not be bundled but instead looked up from the global context. For example, `--external underscore` specifies that the underscore module should not be included in the build result. Any references to underscore will be ignored.

`--remap <name>=<expression>`: specifies that `require(name)` should return whatever the value of the expression is. This is useful for remapping external modules. For example you might want to load jQuery externally from `window.$` using `--remap jquery=window.$`.

`--no-externals`: this option prevents any modules from under `node_modules` from being included.

`--include-external <name>`: this option adds an external back after `--no-externals` (whitelist approach).

`--only-externals`: this option only bundles modules under `node_modules`.

### Middleware enhancements

*Short form syntax*:

    app.use('/js/main.js', glue('./client/index.js'));

    app.use('/js/deps.js', glue([ 'backbone', 'underscore']);

Another example:

    app.use('/js/deps.js', glue('./client/', { 'only-externals': true }));
    // e.g. /js/foo.js => bundle containing ./client/foo.js
    app.use('/js/', glue('./client/', { 'no-externals': true }));

*Preheat cache*: pre-emptively run the first build when the server starts.

*Middleware error messages*: the Express middleware now returns a piece of code which prints an error both in the console and as HTML when the files in the build have syntax errors.

Requires `debug` to be true.

*Middleware etags support*: if the module bundle has not changed, then the Express middleware will completely skip rebuilding the file.

### Shimming non-commonJS libraries that export globals

*Interoperability with libraries that export globals*.

Two options:

- use `--remap` and remap the global, include two files instead of one file
- append `module.exports = global`, using Command:

`--shim { file: "", name: "", global: "", deps: "" }`.

This wraps the file in a way that the global variable is available as `require(name)`.

### Misc

*Ignoring files*. `--ignore file` replaces the file with an empty file in the build.

*Mocking out dependencies for testing*: This is probably more useful when used via the Express middleware, but `--remap name=path` allows specific externals to be replaced, which can be used for testing:

    // example

Might be nice to make this even easier to use from tests... via REST API?

## Inclusion optimization

- Allow coercion of dependencies (e.g. backbone with underscore + plain underscore => one of each):
  - `--dedupe-force modulename` should force only a single instance of a module, in spite of conflicting package.json data


### Replacing modules or individual files

*Substituting a module*. To replace a module with a different module in gluejs, use the `remap` option:

    remap: { "underscore": "require('lodash')" }

via the command line, this would be written as `--remap underscore="require('lodash')"`.

*Substituting a file*. The `browser` field in package.json is a new addition which allows CommonJS bundlers to replace files which are not compatible with the browser with alternatives provided by the module. You can use this to replace files in your build, and it can also be used by 3rd party modules which support both the browser and Node.

You can replace the whole package with a specific file:

    "browser": "dist/browser.js"

or you can override individual modules and files in `package.json`:

    "browser": {
      "fs": "level-fs",
      "./lib/filters.js": "./lib/filters-client.js"
    },

This will replace `./lib/filters.js` with `./lib/filters-client.js` in the build result.

### Core variable and core module shimming

- detect core modules and core variables
- load appropriate shims

### Optimistic rebuilding

- Continuous rebuild via watcher
  - file changes
    - rebuild every n milliseconds, return results in a non-blocking manner
  - dir content changes
    - trigger full rebuild

# Tasks

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
- Mocking out dependencies during testing/runtime **
- RequireJS to CommonJS conversion
- Easier conventions for adding a module both on the client and server side, e.g. only a node_modules entry => client side

# Internals

Minor, but cool features:

- build non-JS resources, for example compile Jade and Handlebars templates
- choice between throwing, or returning undefined in the require shim

## New architecture

Cleaner separation between Map and Reduce phases.

During the Map phase, a number of tasks are applied to each file.

The tasks take one input, run it through transforms, and write a file into cache. If nothing needs to be done, then a simple direct-read tuple is created.

The Map phase uses a shared queue which supports incremental task queueing.

During the reduce phase, the list of metadata tuples is converted into a set of packages using package inference. Then, the underlying data for each metadata tuple is read in serial order and written to the final output. On read, the final wrapping is done, utilizing the inferred packages.

If any tasks require the package metadata, then they must be performed during the reduce phase. In theory one could add another map phase after packages have been inferred.

    -- check for full build match --

Transform queue (transforms/index.js):

    [ Initialize queue ]
    [ Add new file ]
      [ Check that file has not been processed ]
      [ Check for cached results, and return if done ]
      [ Apply user and other exclusions ]
      [ Queue task ]
    [ Task run]
      [ Match tasks ]
      [ If no tasks, just run the parse-result-and-update-deps ]
        [ Push deps to queue when done ]
      [ If transformations, append parse-result-and-update-deps task ]
      [ Run transforms ]
        [ Push deps to queue when done ]
    [ Start running the queue ]
      [ Once done ]
        [ Check queue for more, assign if under parallelism limit ]

    { filename: path-to-file, content: path-to-file, deps: [ "str", "str2" ] }
    { filename: "original-path-to-file", content: path-to-result-file, deps: [ "str", "str2" ] }

    -- generate joinable list --

TODO:

- report number of cache hits from the transforms
- progress bar support:
  - emit progress events (e.g. as each file is processed)
  - emit progress done event

Package generator queue (commonjs2/index.js):

    [ Infer packages ]
    [ Infer package deps ]
      - for --parse: just collect
      - for --no-parse: guess (e.g. modules in folders at higher levels, and one-level-removed child node_modules)

    [ Update reporter size during read ]
    [ Wrap file during read (w/ full meta?) ]


    {
      id: ..,
      main: "original-name",
      basepath: ...,
      files: [ ... ],
      deps: { "name": "target" }
    }

    [ Join files ]

    -- generate full build --

TODO:

- replaced/remapped support
- progress bar support:
  - emit progress events (e.g. as each file is processed)
  - emit progress done event

Current wrappers:

- size report
- UMD
- commonJS
- JSON

Additional wrapping:

- shimmed global export
- pre-wrap additional module detection

## use detective and amdetective

Steps:

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



