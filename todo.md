
-----

# Todo

- refactor the options handling into a single file

Major issues:

- make the deps format native rather than a conversion from files format
- exclude non-js files by default (related: figure out how to take care of default includes)
- tests
  + symlinks
  + dedupe
- dedupe edge case:
  - two result entries get added for a file that is a duplicate, which means that the .canonicalize logic does not catch the duplication
  - the two duplicates correctly share the same cache content (e.g. the file is not processed twice)
  - in order for this to happen, the cache has to return a dedupe filename result for the second duplicate; this means that the entry in the .canonicalize table does not get added and then the .canonicalize logic does not catch the duplication which allows the second entry to persist
  - this is probably the result of caching dedupe results, which can be incorrect until the very end
  - the root of the problem is the persistence of early dedupe results, a correct approach is to:
    - never cache the preliminary dedupe results, to enable the canonicalization to always take place
    - for cached entries, add an entry for canonicalization without doing a check
    - if the file itself does not have a cache entry, then run dedupe to see if the current file is a duplicate of a file seen earlier in the run
    - at the time the deduplication result returns, check whether a full cache result exists
    - if not, then process the file even if it is a duplicate (do extra work)
    - if duplicate work was done, rely on the canonicalization to remove references to the duplicated file with the longer path from the set of entries
- module ids are not canonicalized, so they cannot be looked up against in a flexible manner, requiring several variant entries to be placed in the output (e.g. full path, full path without .js and so on).
  - This could be resolved by canonicalizing and including the slightly larger but more robust alternative require() implementation
  - This is needed for --global-require to be useful
- document how to target --transform and --command
- transforms should only run on main files
- better transform targeting
  - to run a transform on all the main package files: --transform
  - to run a transform on main package files matching a particular extension: --transform ext=str
  - to run a transform on dependency files: package.json browserify field
  - to run a transform on the full build result
    - in the shell: pipe the build result to the next command
    - in the API: `.pipe()` method
- factor-bundle
- streaming api
- intreq
- update CLI docs
- user-friendly handling of parse errors in the http version?
- source map sourceRoot is not configurable (core issue is in browser-pack which doesn't configure this option)
- reporting
  - handle spurious --exclude package --ignore package targets a bit better: rigth now, they are resolved twice, once during setup and once during transform-runner. Might want to say that you should remove any unnecessary exclusions.
  - handle empty remap targets better. Sometimes --remap package=foo may be intentional, though it is odd to include one if there are no references to it.
  - when the cache is triggered, file adds log lines are not shown, and exclusions are simply by "regexp true" rather than the correct regexp.

----

# 3.1 tasks

- gzip support
- time reporter
- in memory cache / file-granular rebuild
- core shims? might not be too hard
- AMD
  - the sorter does not normalize dependency names before resolving them (e.g. for relative refs to remapped paths from remapped paths)
  - better exclusions
    - nomin should work on folders
    - ability to treat app paths as vendor paths (e.g. to exclude them when running a minifier). This occurs when files found during the application file static resolution actually finds vendor files and then tries to minify them

### API refactor

Convert into a pipeline consisting of:

- `transform-runner`: takes an initial set of files + tasks, emits JSON objects with the necessary dependencies
- `etagger`: handle etags
- `gluejs-pack`: takes a set of JSON objects and generates a JS package file from them

Code:

    runner.exclude(exclude)
          .ignore(ignore)
          .on('...');

    list.include(include)
        .pipe(runner)
        .pipe(etagger)
        .pipe(packager)
        .pipe(dest);

----

### Targeting transforms

`--extensions`. By default, only .js and .json files are included in builds.

If you want to add further extensions, such as `.coffee` or `.jade`, you can use the `--extensions` option to add more supported extensions. For example: `--extensions .jade` will allow you to `require('./foo')` and have it match `./foo.jade` in the same folder.

`--command extension=str` and `--transform extension=str`: these extended versions of command and transform specification allow you to load and apply transforms on specific file extensions. For example: `--transform .jade=jadeify` will apply the `jadeify` transform on `.jade` files.



- also allow coffee=coffeeify without the dot
- --global-transform should allow transforms to run globally
- --global-command

Also full build result transform?

----

## Node core shims

- add core module shimming support
- obscura related to module vars:
  - [require.main](https://github.com/substack/node-browserify/issues/234)

----

### Missing dependency handling

--ignore-missing: causes missing modules to be ignored, require() on them returns {}
--exclude-missing: causes missing modules to be excluded, require() on them will be looked up from the higher-level scope, if not found, an error is thrown.
Default: warn about missing

----

### Symlink handling

- [use real paths](https://github.com/substack/node-browserify/pull/549)
- [avoid duplication due to symlinks](https://github.com/substack/node-browserify/issues/444)
- [test w/modules using npm link](https://github.com/substack/node-browserify/issues/692)

----

- add `cache clean`
- pouchdb might make for a good benchmark

Look into how deamdify, deglobalify and es6ify might be made to work w/gluejs.

https://github.com/substack/node-browserify/pull/336

browserify.transform field in package.json

By default browserify considers only `\*.js` files in such cases.
Note, that if files do not contain javascript source code then you also need to specify a corresponding transform for them.

Strip BOMs

https://github.com/substack/node-browserify/issues/313

Tests
- Strip # (probably already OK, just add test)
- gluejs --include . => return equivalent package
- parse invalid json file
- transforms installed globally should also work
- require() a core module should look in your node_modules/ directory before using one of its browser builtins
- allow core modules to be ignored
- allow core modules to be ignored in package.json browser field
- [--standalone A.B.C should construct nested objects](https://github.com/substack/node-browserify/issues/534)

--no-parse file support

- maybe: allow bundles to just have a delegating require() impl

[via](https://github.com/substack/node-browserify/issues/577):

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

### Core variable and core module shimming

- detect core modules and core variables
- load appropriate shims

# Evaluation

- empirically based packaging / dynamic loading **
- Mocking out dependencies during testing/runtime **
- RequireJS to CommonJS conversion

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

## use amdetective

- amd:
  - config.js loading
  - better resolve error reporting
  - resolve value overrides
  - use the almond shim (?). Alternative is to just output a bundle of define()s

Test cases:

- apply .npmignore last

## Tiny module optimizations

- add support for fully static resolution: given the full set of require() call dependencies, convert them into static lookups

## Docs todo

- need a good example of applying a transformation via the API
- need a good example of using a transformation with the Express middleware
- `--global-require` example (e.g. how to make `require('foo')` work in arbitrary script tags)
- example of running a bundle result (UMD) in Node
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

# How do I ...?

## How do I package tests for the browser?

There is a builtin Mocha test server task, which takes a set of tests as input and creates a server specifically for running one or more tests.

If you're not using Mocha, you can still use the API to create a package and serve it (with test-framework wrapping).
