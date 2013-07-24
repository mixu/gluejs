# gluejs

Package Node/CommonJS modules for the browser

New and improved gluejs v2.


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

## Usage example

    gluejs \
      --include ./lib/ \
      --include ./node_modules/microee/ \
      --global App \
      --main lib/index.js \
      --out app.js \
      --command 'uglifyjs --no-copyright --mangle-toplevel'

All of these options are also available via a Node API (e.g. `require('gluejs')`).

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
    --global Foo \
    --main lib/index.js \
    --out dist/foo.js

With that option, all files are piped through `uglifyjs` before writing to disk.

Gorgeous new reporter, with stats on savings from minification:

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

````bash
Usage: node ./bin/gluejs --include <file/dir ...> --out filename.js

Options:
  --include         Path to import.
  --exclude         JS regular expression string to match against the included paths
  --out             File to write. Default: stdout
  --global          Name of the global to export. Default: "Foo"
  --basepath        Base path for relative file paths. Default: process.cwd()
  --main            Name of the main file/module to export. Default: index.js
  --replace foo=bar Bind require("name") to an expression, e.g. jQuery to window.$.
  --source-url      Add source URL annotations to the files. Useful for development,
                    but note that they are not compatible with IE.
  --global-require  Export the require() implementation into the global space.
  --amd             Export the module via the require.js AMD define("name", ...) using
                    the name specified in --global. Note that the requirejs will not
                    pick up modules defined like this unless you do at least one
                    asynchronous require() call.
  --command         Pipe each file through a shell command and capture the output
                    (e.g. --command "uglifyjs --no-copyright").
  --silent          Disable all output, including the reporter.
  --verbose         More verbose output, such as files being filtered out and processed.
````

## API usage example

```javascript
var Glue = require('gluejs');
new Glue()
  .basepath('./lib') // output paths are relative to this
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

## --exclude

`--exclude <regexp>` / `.exclude(regexp)`: Excludes all files matching the regexp from the build. Evaluated just before rendering the build so it applies to all files.

## --global

`--global <name>` / `.export(name)`: Name of the global name to export. Default: `foo` (e.g. `window.foo`)

## --basepath

`--basepath <path>` / `.basepath(path)`: Base path for relative file paths. All relative paths are appended to this value. Default: process.cwd().

## --main

`--main <filename>` / `.main('filename')`: Name of the main file/module to export. Default: index.js.

## --out

`--out <path>` / `.render(destination)`: Write to the target path.

For `.render`, the destination can be either a Writable Stream or a callback `function(err, output){}`. See the API usage example above.

## --replace

`--replace name=expr` / `.replace(name, value)` / `.replace({ name: ... })`: Replace the return value of a `require()` call.

For example, to bind `require('underscore')` to `window._`:

    --replace underscore=window._

To bind `require('fs')` to `undefined`:

    --replace fs={}

Using a global require (e.g. to bind to the value of a AMD module):

    --replace sha1="window.require('sha1')"

## --source-url

`--source-url` / `.set('source-url', true)`: Source URLs are additional annotations that make it possible to show the directory tree when looking at scripts (instead of just the one compiled file):

![screenshot](https://github.com/mixu/gluejs/raw/master/test/sample/sourceurl.png)

To enable source URLs, set the following option:

```javascript
.set('debug', true)
```

Note that source URLs require that scripts are wrapped in a eval block with a special comment, which is not supported by IE, so don't use source URLs for production builds.

## --command

`--command <cmd>` / `.set('command', <cmd>)`: Pipe each file through a shell command and capture the output. For example:

    --command "uglifyjs --no-copyright"

## --cache

`--cache <path>` / `.set('cache', <path>)`: Use a cache for file builds (disabled by default). This is a directory where the results of the previous build are stored along with metadata.

The cache speeds up large builds (and minified builds) significantly since only source files that have changed (different last modified date; different file size or different build options) are updated.

Use a directory with a dot in front to hide the cached files (remember to also gitignore the directory). The path is relative to the working directory. For example:

    --cache .cache

When the cache is in use, the number of cache hits are shown:

    Cache hits: 2 / 2 files

To get even more info, enable `--verbose`.

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

## --amd

`--amd` / `.set('amd', true)`: AMD compatible export, invokes `define('foo', ...)` to register the package with a AMD loader using the name specified in `--global`.

Note that Require.js will not pick up modules defined like this unless you do at least one asynchronous require() call, e.g. you need to run the no-op code `require(['foo'], function(foo){ });` before `require('foo')` will work. This seems to be a quirk in the Require.js AMD shim.

## --verbose

`--verbose` / `.set('verbose', true)`: More verbose output, such as files being filtered out and processed.

## --silent

`--silent` / `.set('silent', true)`: disable verbose logging

## A few notes about npm dependencies

The main file is determined by looking at the "main" key in package.json and resolution follows the require() rules as documented in the Node API docs.

Only files ending with .js are included in the builds, since require() only works with .js, .json and .node files (the last one being for compiled native modules).

The .npmignore file is honored. It works like a .gitignore file. This is the preferred way of excluding files and directories from npm dependencies according to `npm help developers`.
