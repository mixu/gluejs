# What's new in v3

gluejs v3.next adds dependency parsing support:

- Passing `--parse` enables dependency parsing, which can figure out the full dependency graph given just a single entry point. More accurate exclusions may result in smaller output size but come with a performance cost. Note that parsing dependencies is slow (e.g. the performance is closer to browserify's performance).
- Benefits:
  - provides more accurate exclusion information (e.g. modules not connected from the main file can be ignored; files like package.json can often be safely excluded)
  - allows the user to only specify `--main` without any includes
  - allows us to auto-detect node_modules dependencies without explicit include management (making live reload possible / nice)
  - paves way for efficient node core module support
- The caching system has been significantly improved, with some minor performance gains and reduced file handle usage.
- The [browser field](https://gist.github.com/defunctzombie/4339901) in package.json files is supported via [browser-resolve](https://github.com/defunctzombie/node-browser-resolve)
- `--replace` has been deprecated in favor of `--remap`. modules will only be loaded when requested, not earlier.
- direct file requires like `require('jade/runtime')` should now resolve correctly
- *Ignoring files*. `--ignore file` replaces the file with an empty file in the build.

-----

# Todo

- Parse:
  - disable the automatic excludes like `/dist/` because they mess with things like jquery
- Test against parse errors causing issues, such as caching the incorrect set of dependencies.
- Return proper error messages for parse errors when using the middleware

- Etag:
  - when a build finishes, store a cache entry for the full build (using all the options)
  - allow querying gluejs by the build hash, which will return the full build if it exists in the cache,
  and otherwise do a rebuild using the given options

- add `cache clean`

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

    app.use('/js/deps.js', glue({ include: './client/', 'only-externals': true }));
    // e.g. /js/foo.js => bundle containing ./client/foo.js
    app.use('/js/', glue({ include: './client/', 'no-externals': true }));

*Preheat cache*: pre-emptively run the first build when the server starts.

*Middleware error messages*: the Express middleware now returns a piece of code which prints an error both in the console and as HTML when the files in the build have syntax errors.

Requires `debug` to be true.

*Middleware etags support*: if the module bundle has not changed, then the Express middleware will completely skip rebuilding the file.

*Switching between development and production modes*:

- allow using the same code paths for production and dev
- use a specific staging area folder
  - in dev, check the upstream folders for changes
  - in production, simply serve the staging area contents

Example:

    if (development) {
      app.use();
    } else {
      glue.package();
      app.use(express.static(outDir));
    }

### Shimming non-commonJS libraries that export globals

*Interoperability with libraries that export globals*.

Two options:

- use `--remap` and remap the global, include two files instead of one file
- append `module.exports = global`, using command:

`--shim { file: "", name: "", global: "", deps: "" }`.

This wraps the file in a way that the global variable is available as `require(name)`.

-> this is basically `--remap name=require(file) --no-parse file --append-text file "module.exports = global;"`

### Misc

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

# Evaluation

- empirically based packaging / dynamic loading **
- Source maps support
- Mocking out dependencies during testing/runtime **
- RequireJS to CommonJS conversion
- Easier conventions for adding a module both on the client and server side, e.g. only a node_modules entry => client side

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

Queue tasks:

- Expression syntax:
  - files: ./relpath, /abspath/
    - directories => all files in the directory and all subdirs
  - modules: name
- Components:
  - full path matcher (e.g. exclude.match(filepath))
  - module name matcher (e.g. exclude.matchPackage(name, parent))
- Enable doing things like:
  - files
    - applied during the iteration
      - include (--include)
      - exclude (--exclude, --remap, --only-externals)
      - ignore (--ignore)
      - rename (detecting renames due to browser field)
    - applied after the iteration
      - replace (content)
      - rename
      - add tasks (--shim, --source-url)
  - modules
    - exclude (--external, --no-externals, --include-external)
    - ignore (--ignore)
    - replace (--remap)
  - package level
    - --umd
    - --global-require

in a generic way by defining a bunch of callbacks, rather than doing these each in ugly and ad-hoc ways.

--shim:

--no-externals:

    {
      expr: '*'
      type: 'package-filter',
      task: function() {
        return false;
      }
    }

--only-externals:

    {
      expr: base + '/**',
      phase: 'file-filter',
      task: function() {
        return false;
      }
    }

--ignore:

argv.ignore.toExpr()

    {
      expr: file paths,
      phase: 'file-filter',
      task: function() {
        // no need to parse the file since it's always an empty file
        self.addResult(filename, self.ignoreFile, [], [], []);
        // queue has been updated, finish this task
        self.emit('miss', filename);
        return false;
      }
    }
    {
      expr: packages,
      phase: 'package-filter',
      task: function() {
        return false;
      }
    }

TODO:

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

- progress bar support:
  - emit progress events (e.g. as each file is processed)
  - emit progress done event

## use detective and amdetective

Steps:

- apply later stage optimizations:
  - minimize the list of --replace shimmed modules in each package output based on the real set of dependencies from all files within that package
  - add core module shimming support
- amd:
  - config.js loading
  - better resolve error reporting
  - resolve value overrides
  - use the almond shim (?). Alternative is to just output a bundle of define()s

Test cases:

- apply .npmignore last
- perf test: load large directory a couple of hundred times and ensure caching works

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
