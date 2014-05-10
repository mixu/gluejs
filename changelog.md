# What's new in v2.3

gluejs v2.3 adds UMD support and performance / robustness improvements.

- UMD support: you can now run the same build result in Node and AMD and in the browser. This enables three use cases:
  - you can use gluejs bundles in AMD/Require.js (via config.js, see the relevant section below)
  - you can share the same file between AMD and Node
  - you can use gluejs to produce a minified/obfuscated version of your codebase that's usable in Node
- chained require() resolution. The gluejs `require()` shim has been redesigned so that if a `require` function is already defined, then it will fall back to that function. This has two implications:
  - if `--global-require` is set (exporting the `require()` function), you can split your app into multiple bundles loaded separately in the browser and they will appropriately chain require() calls as long they are loaded in prerequisite order
  - UMD bundles running under Node will fall back to using Node's native `require` for modules that are not in the bundle
- Added pre-filters to skip .git / svn / hg / cvs directories for better performance
- Improved the behavior of the cache when the metadata is corrupted or in an unexpected format

## What's new in v2.2

Note: if you are upgrading from an older version: the default value for `--global` is now `App` rather than `Foo`.

gluejs v2.2 adds Express middleware for serving gluejs packages, thanks [@JibSales](https://github.com/JibSales).

## What's new in v2.1

Note: if you are upgrading from v2.0: `--cache` is now called `--cache-path`.

gluejs v2.1 adds significant performance improvements over v2.0! In addition, it adds support for custom transformations, including ones that were written for [browserify](https://github.com/substack/node-browserify#list-of-source-transforms).

- the task execution engine now supports running multiple tasks concurrently while producing a single output file. Most build systems only use a single output stream, which means that expensive tasks such as `uglifyjs` are run on each file in serial order. gluejs v2.1's new engine executes all tasks in parallel, kind of like MapReduce at a small scale (configurable via `--jobs`).
- anecdotally, this has reduced build time for CPU-intensive builds (e.g. minifying a large number of files) by ~50% by making use of all the available CPU cores.
- the system now enables caching by default; if you run the same gluejs task twice, only the changed files are re-processed. Changes are detected either using md5 hashing or filesize + modification time. Caching used to be an advanced option, but it helps a lot in practice so I figured I'd enable it by default. You can opt out via `--no-cache`, but why?
- the cache supports multiple versions of the same input file (e.g. if you have a gluejs task for a debug build and a production build, switching between the two no longer invalidates the cache).
- added support for custom transformations, such as compiling template files and other compile-to-JS files.

For example, on a Macbook Pro using a ~1.2Mb input with ~600 files and applying minification (which is CPU-intensive), `--no-cache --jobs 1` (e.g. force serial execution):

    0:56.75 wall clock time, 39.90 user, 21.18 system

and `--no-cache` (e.g. parallel execution with default options):

    0:18.89 wall clock time, 72.78 user, 29.04 system

In other words, the build completes almost 3x faster than before.

## What's new in v2

gluejs (v2) is a comprehensive refactoring to make use of Node 0.10.x -style streams (under 0.8.x via [readable-stream](https://github.com/isaacs/readable-stream)).

- internals refactored to make working with unix pipes (e.g. minification, obfuscation etc.) much easier via Node 0.10.x streams
- internals refactored to make file operation easier to apply (e.g. each task is separated into it's own pipe)
- faster repeated builds via file caching
- more accurate npmignore/gitignore matching

## V2 new features

Easier minification (or other processing) via `--command`:

    gluejs \
    --include ./lib \
    --replace jQuery=window.jQuery \
    --command 'uglifyjs --no-copyright' \
    --global App \
    --main lib/index.js \
    --out app.js

With that option, all files are piped through `uglifyjs` before writing to disk.

Gorgeous new reporter (enable via `--report`), with stats on savings from minification:

    # Root package
      lib/web/shim.js                          12.94kb 38% -> 3.84kb (-9324b -71%)
      lib/common/shim.util.js                  4.65kb  13% -> 1.21kb (-3524b -75%)
      lib/common/outlet.js                     4.07kb  12% -> 2.05kb (-2074b -50%)
      lib/common/view.js                       3.94kb  11% -> 1.93kb (-2054b -51%)
      lib/common/collection_view.js            2.09kb  6 % -> 1.03kb (-1082b -51%)
      lib/common/collection.js                 1.18kb  3 % -> 494b   (-716b  -60%)
      lib/common/table_view.js                 458b    1 % -> 38b    (-420b  -92%)
      lib/web/index.js                         271b    0 % -> 280b   (9b     3%)
    Package total: 29.59kb 88% -> 10.85kb (-19185b -64%)
    Package dependencies: htmlparser-to-html, microee
    # htmlparser-to-html
      node_modules/htmlparser-to-html/index.js 2.43kb  7 % -> 1.26kb (-1190b -48%)
    Package total: 2.43kb 7% -> 1.26kb (-1190b -48%)
    # microee
      node_modules/microee/index.js            1.24kb  3 % -> 900b   (-366b  -29%)
    Package total: 1.24kb 3% -> 900b (-366b -29%)
    Total size: 12.99kb (-20741b -61%)

Report explained:

    lib/web/shim.js                          12.94kb 38% -> 3.84kb (-9324b -71%)
    [filename]         [original size] [% of total] -> [minified size] (savings in bytes and %)

The `.npmignore` and `package.json` exclude logic is now more accurate, leading to smaller builds.

-----

## Upgrading from gluejs v1 to v2

The command line option syntax has changed: `gluejs --include foo bar` has to be written as `gluejs --include foo --include bar`.

The `--npm foo` option no longer exists. Instead, just `--include ./node_modules/foo`, the package inference engine will figure out that the target is a npm module and handle it correctly.

The `.concat(packageA, packageB)`, `.define(module, code)`, `.defaults()` features are deprecated (use bash or string concatenation; use different --include statements).
