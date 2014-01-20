# gluejs V2

Package Node/CommonJS modules for the browser

New version! gluejs v2 is now out with a bunch of new features ([v1 branch](https://github.com/mixu/gluejs/tree/master))


- Converts code written for Node.js to run in the browser
- Lightweight require shim (~400 characters, minified but not gzipped)
- Easy to connect to intermediate shell tasks (e.g. minifiers) due to streams2 support
- Fast (can use caching to avoid rebuilding unchanged files)
- Programmable: use the Node API to serve packages directly, or build static packages using the command line tool
  - render() to console, or directly to a HTTP request
  - include() files or full directories, blacklist using exclude(regexp)
- Bind variables under window.* to require() statements using replace()
- Compile templating language files to JS via a custom handler
- Source url support

## Usage example: console

    gluejs \
      --include ./lib/ \
      --include ./node_modules/microee/ \
      --global App \
      --main lib/index.js \
      --out app.js \
      --command 'uglifyjs --no-copyright --mangle-toplevel'

All of these options are also available via a Node API (e.g. `require('gluejs')`).

## Usage example: express middleware (new in v2.2!)

    var express = require('express'),
        glue = require('gluejs'),
        app = express();

    app.use(express.static(__dirname + '/index.html'));

    app.use('/app.js', glue.middleware({
      include: [ './lib', './node_modules/microee/' ]
    }));

    app.listen(3000);
    console.log('Listening on port 3000');

`glue.middleware()` can accept most of the options supported by the Node API.

## Using the resulting file

The build result is a standalone file, which is exported as a global (`lib/index.js` is exposed as `App`):

    <script src="app.js"></script>
    <script>
      console.log(window.App); // single external interface to the package
    </script>

The require() statements inside the package work just like under Node, yet none of the internals are leaked into the global namespace.

gluejs does not export a global "require()" function in the browser; this means that it is compatible with other code since all details are hidden and only a single interface is exported (main file's ```module.exports```). The reasons behind this are documented in much more detail in my book, "[Single page applications in depth](http://singlepageappbook.com/maintainability1.html)". If you want to export the require implementation, you can use `--global-require`.

An additional benefit is that you only need one HTTP request to load a package, and that the resulting files can be redistributed (e.g. to a non-Node web application) without worry. If you need to set breakpoints inside files, use `--source-url` to enable source urls.

## Installation

To install the command line tool globally, run

    npm install -g gluejs

Alternatively, you can run the tool (e.g. via a Makefile) as `./node_modules/gluejs/bin/gluejs`.

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

## Neat new features

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

## Upgrading from gluejs v1

The command line option syntax has changed: `gluejs --include foo bar` has to be written as `gluejs --include foo --include bar`.

The `--npm foo` option no longer exists. Instead, just `--include ./node_modules/foo`, the package inference engine will figure out that the target is a npm module and handle it correctly.

The `.concat(packageA, packageB)`, `.define(module, code)`, `.defaults()` features are deprecated (use bash or string concatenation; use different --include statements).

## Usage

````markdown
Usage: gluejs --include <file/dir ...> {OPTIONS}

## Basic

  --include         Path to import.
  --exclude         JS regular expression string to match against the included paths
  --out             File to write. Default: stdout
  --global          Name of the global to export. Default: "App"
  --basepath        Base path for relative file paths. Default: process.cwd()
  --main            Name of the main file/module to export. Default: index.js

## Replace / remap

  --replace foo=bar Bind require("name") to an expression, e.g. jQuery to window.$.
  --remap foo=bar   Remap a name to another name (within the same package). See the docs.

## Build options

  --source-url      Add source URL annotations to the files. Useful for development,
                    but note that this is not compatible with IE.
  --global-require  Export the require() implementation into the global space.
  --amd             Export the module via the require.js AMD define("name", ...) using
                    the name specified in --global. Note that the requirejs will not
                    pick up modules defined like this unless you do at least one
                    asynchronous require() call.

## Minification / source transforms

  --command         Pipe each file through a shell command and capture the output
                    (e.g. --command "uglifyjs --no-copyright").
  --transform       Activates a source transformation module.

## Performance

  --cache-path      Use a cache directory to store file builds. The cache speeds up
                    large builds (and minified builds) significantly since only source
                    files that have changed are updated.
  --jobs            Sets the maximum level of parallelism for the task
                    execution pipeline. Default: `os.cpus().length * 2`
  --cache-method    Sets the cache method: stat | hash algorighm name.

## Reporting

  --report          Display the file size report.
  --silent          Disable all output, including the reporter.
  --verbose         More verbose output, such as files being filtered out and processed.
  --version         Version info

## Advanced

  --reset-exclude   Advanced: do not apply the default exclusions
                    (/dist/, /example/, /benchmark/, .min.js).
````

## API usage example

```javascript
var Glue = require('gluejs');
new Glue()
  .basepath('./lib') // output paths are relative to this
  .main('index.js')  // the file that's exported as the root of the package
  .include('./lib')  // includes all files in the dir
  .exclude(new RegExp('.+\\.test\\.js')) // excludes .test.js
  .replace({
    'jquery': 'window.$ ', // binds require('jquery') to window.$
    'Chat': 'window.Chat'
  })
  .export('App') // the package is output as window.App
  .render(fs.createWriteStream('./out.js'));
```

You can also render e.g. to a http response:

```javascript
  .render(function (err, txt) {
    // send the package as a response to a HTTP request
    res.setHeader('content-type', 'application/javascript');
    res.end(txt);
  });
```

## --include

`--include <path>` (console) / `.include(path)` (API).

- If the path is a file, include it.
- If the path is a directory, include all files in it recursively.
- If the path is a node module, include all files in it and all subdependencies in the build.

Sub-dependencies are also automatically bundled, as long as they've been installed by npm. Since the require() semantics are the same as in Node, subdependencies can depend on different versions of the same module without conflicting with each other.

`.json` files are also supported; just like in Node, you can use `require('./foo.json')` within the resulting bundle.

## --exclude

`--exclude <regexp>` / `.exclude(regexp)`: Excludes all files matching the regexp from the build. Evaluated just before rendering the build so it applies to all files.

`--reset-exclude`: **New advanced option**. Removes the default exclusions (matching /dist/, /example/, /benchmark/, [-.]min.js$). For example: `--reset-exclude --exclude '/foo/'`.

## --global

`--global <name>` / `.export(name)`: Name of the global name to export. Default: `App` (e.g. `window.App`)

## --basepath

`--basepath <path>` / `.basepath(path)`: Base path for relative file paths. All relative paths are appended to this value. Default: process.cwd().

## --main

`--main <filename>` / `.main('filename')`: Name of the main file/module to export. Default: index.js.

## --out

`--out <path>` / `.render(destination)`: Write to the target path.

For `.render`, the destination can be either a Writable Stream or a callback `function(err, output){}`. See the API usage example above.

## .middleware

`.middleware({ include: ... })`: Returns a Express/Connect compatible request handler.

For example:

    app.use('/js/app.js', glue.middleware({
      include: __dirname + '/lib'
    }));

Or at the route level:

    app.use(app.router);
    app.get('/js/app.js', glue.middleware({
      include: __dirname + '/lib'
    }));

Using full paths is recommended to avoid ambiguity. `basepath` defaults to the `include` path, and `main` defaults to `index.js`.

## --replace

`--replace name=expr` / `.replace(name, value)` / `.replace({ name: ... })`: Replace the return value of a `require()` call.

For example, to bind `require('underscore')` to `window._`:

    --replace underscore=window._

To bind `require('fs')` to `undefined`:

    --replace fs={}

Using a global require (e.g. to bind to the value of a AMD module):

    --replace sha1="window.require('sha1')"

## --remap

`--remap name=expr` / `.remap(key, value)`: Remap a name to another name (within the same package).

For example, to remap `require('assert')` to `require('chai').assert`:

    --remap "assert=require('chai').assert"

When you are binding to a external module, use `--replace`. When the module is internal to the package (e.g. fs, assert, ...), use `--remap`. Basically the difference is that `--remap` dependencies are only resolved when they are first required, whereas `--replace` is a direct assignment / evaluation. The delayed evaluation is needed for internal modules to prevent circular dependencies from causing issues during load time.

## --source-url

`--source-url` / `.set('source-url', true)`: Source URLs are additional annotations that make it possible to show the directory tree when looking at scripts (instead of just the one compiled file):

![screenshot](https://github.com/mixu/gluejs/raw/master/test/sample/sourceurl.png)

To enable source URLs, set the following option:

```javascript
.set('source-url', true)
```

Note that source URLs require that scripts are wrapped in a eval block with a special comment, which is not supported by IE, so don't use source URLs for production builds.

## --command

`--command <cmd>` / `.set('command', <cmd>)`: Pipe each file through a shell command and capture the output. For example:

    --command "uglifyjs --no-copyright"

For more complicated use cases, you'll probably want to use `--transform`.

## --transform (v2.1)

`--transform <module>`: activates a source transformation module. This enables 3rd party extensions for things that are more complex than just piping through via `--command`.  API-compatible with browserify's [source transformation modules](https://github.com/substack/node-browserify#list-of-source-transforms).

This feature is new, so let me know if you run into issues with it.

For example, using coffeeify:

    npm install coffeeify
    gluejs --transform coffeeify --include index.coffee > bundle.js

gluejs uses [minitask](https://github.com/mixu/minitask) internally, so you can also write modules that return sync / async functions, Node core duplex / transform streams or Node core child_process objects.

See the [section on writing transform modules](#writing_transform_modules) as well as [this example which uses Square's ES6-module-compiler](https://github.com/mixu/gluejs/blob/glue2/test/command-integration/es6-module.js) and [Jade example](https://github.com/mixu/gluejs/blob/glue2/test/command-integration/jade-module.js) for examples.

If you write a transformation, file a PR against the readme so I can feature it here. I've tested functionality using the examples above, but I haven't published them as modules as it's hard to maintain something I'm not using.

## --report

Display the summary report. Particularly useful if you are minifying files, since the report will show the file size after transformation.

## --jobs (v2.1)

`--jobs <n>` / `.set('jobs', <n>)`: Sets the maximum level of parallelism for the task execution pipeline. Default: `os.cpus().length * 2`.

## --cache-path (v2.1)

`--cache-path <path>` / `.set('cache-path', <path>)`: Use a specific directory for caching. This is a directory where the results of the previous builds are stored along with metadata. Caching is enabled by default in v2.1. If a path is not set, then `~/.gluejs-cache` is used for storing cache results. You can just delete the directory to invalidate the cache.

The cache speeds up large builds (and minified builds) significantly since only source files that have changed are updated.

Use a directory with a dot in front to hide the cached files (remember to also gitignore the directory). The path is relative to the working directory. For example:

    --cache-path .cache

When the cache is in use, the number of cache hits are shown:

    Cache hits: 2 / 2 files

To get even more info, enable `--verbose`.

## --cache-method (v2.1)

`--cache-method <stat|md5|sha512>` / `.set('cache-method', <method>)`: Sets the cache invalidation method. `stat` uses the file size and last modified date of the input file. `md5` (and other hash algorithms supported by `crypto.createHash`) uses hashes to verify that the input file has not changed. Default: stat.

## --no-cache (v2.1)

`--no-cache` / `.set('cache', false)`: Disables the cache; sets the cache directory to a temporary directory.

## --global-require

`--global-require` / `.set('global-require', true)`: Overwrites / exports the require implementation from the package, allowing you to call `require()` from outside the package as if you were inside the package.

One use case for this feature is when you want to package and load a fixed set of files and npm dependencies via `require()` calls in the browser.

Dummy index.js:

```javascript
module.export = {};
```

Build command:

```bash
gluejs \
  --include index.js \
  --include node_modules/ \
  --global-require \
  --global App \
  --out package.js
```

HTML page (assuming "foo" is a node module):

```html
<script src="package.js"></script>
<script>
  var foo = require('foo');
</script>
```

With `--global-require`, `require()` statements are resolved as if they were inside index.js.

## --umd (new in v2.3)

`--umd` / `.set('umd', true)`: UMD compatible export.

The resulting bundle can be loaded in Node (directly via require()), in AMD (as an external module) or alternatively as a global (in the browser). All you need to do is to add `--umd` to your build to include the UMD wrapper.

Creating the bundle:

    gluejs \
      --umd \
      --include ./lib/ \
      --include ./node_modules/microee/ \
      --global App \
      --main lib/index.js \
      --out app.js \

In node:

    node -e "console.log(require('./app.js'););"

In AMD/Require.js,`config.js`, assuming `--global` was set to `App`:

    {
      paths: { "myapp": "/app.js" },
      myapp: {
        deps: [ ... ],
        exports: 'App'
      }
    }

after which the module is accessible as `myapp`.

Note that Require.js might not pick up modules defined like this unless you do at least one asynchronous require() call, e.g. you need to run the no-op code `require(['foo'], function(foo){ });` before `require('foo')` will work. This seems to be a quirk in the Require.js AMD shim.

Upgrade note: `--amd`, an older option which was only compatible with AMD/requirejs, is now equivalent to `--umd`.

## --verbose

`--verbose` / `.set('verbose', true)`: More verbose output, such as files being filtered out and processed.

## --silent

`--silent` / `.set('silent', true)`: disable verbose logging

## A few notes about npm dependencies

The main file is determined by looking at the "main" key in package.json and resolution follows the require() rules as documented in the Node API docs.

Only files ending with .js are included in the builds, since require() only works with .js, .json and .node files (the last one being for compiled native modules).

The .npmignore file is honored. It works like a .gitignore file. This is the preferred way of excluding files and directories from npm dependencies according to `npm help developers`.

## Writing transform modules

By default, gluejs only handles files that end with ".js".

You can create custom transform modules that handle other types of files, such as templates for your favorite templating language.

Here is an example:

    var path = require('path'),
        jade = require('jade');

    module.exports = function(filename) {
      // gluejs modules can be skipped by returning false
      if(path.extname(filename) != '.jade') {
        return;
      }

      // Minitask "sync" function
      return function(input) {
        return 'var jade = require(\'jade\').runtime;\n' +
                'module.exports = ' +
                jade.compile(input, { filename: filename }).toString() + ';';
      };
    };

    // indicate that this is a gluejs module rather than a browserify module
    module.exports.gluejs = true;

### Benchmark methodology

Ran this:

    /usr/bin/time -f "\n%E wall clock,\n%U user mode CPU seconds,\n%S kernel mode CPU seconds" \
      gluejs \
      --no-cache \
      --jobs 1 \
      --command 'uglifyjs --no-copyright' \
      --no-report \
      --progress \
      ...

## License

BSD
