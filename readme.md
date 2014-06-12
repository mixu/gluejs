# gluejs V3

`require('modules')` in the browser

New version! gluejs v3 is now out. For v2, see the [v2 branch](https://github.com/mixu/gluejs/tree/glue2).

- Converts code written for Node.js to run in the browser
- Lightweight require shim (~400 characters, minified but not gzipped)
- Faster than browserify: built-in, enabled-by-default, unobtrusive persistent per-file caching
- Comes with Express middleware, CLI build tool and API
- Supports things like minification and template compilation through transforms and commands (compatible with browserify transforms)
- Supports source urls, shimming browser modules and remapping module names in builds
- No core module shims (yet)

## Why gluejs?

`gluejs` exists to fill gaps in `browserify`'s feature set. It follows a similar approach but has different priorities. `gluejs` was first written to resolve an issue with `browserify` ~v1.x where the bundled results were way too large. I needed something that produced small bundles to distribute a number of open source and internal libraries so I wrote `gluejs`.

`gluejs` v2.x was mostly about performance enhancements. browserify now creates much more reasonably-sized output, but it still isn't very performant or robust on large trees (~1k+ files + transformations) and doesn't take advantage of caching. `gluejs` v2.x introduced an enabled-by-default disk cache which made incremental builds extremely fast, a robust task runner and support for browserify transforms.

`gluejs` v3.x adds support for dependency tracing, and enhancements targeted towards serving directly to HTTP from the cache. For example, a full build which takes ~10s in browserify takes ~5s in gluejs, and with caching it takes ~0.4s; most of that time is spent validating the file tree which can also be skipped by using a file watcher.

Dependencies are now statically resolved to provide a better user experience (e.g. including a file automatically picks up any files and modules it depends on). Some parts of the `gluejs` architecture are now closer to `browserify`. The initial resolution code, transform execution and caching are still unique to `gluejs` and these are the bits that make it faster, but the backend packaging now uses browserify's `browser-pack` format, which allows making use of more open source goodies compatible with that format (in addition to browserify transforms).

## What's new in v3.0

gluejs v3.0 adds a number of usability and performance improvements:

- The biggest change is that dependency parsing is now enabled by default. This means that you can specify a single file to `--include` and the full dependency graph is traced out and bundled automatically, like browserify does.
- The middleware has been enhanced significantly with etags support, gzipping, minification and browser-compatible error messages when builds fail.
- Performance for cached builds and builds that use transforms has increased. Enabling dependency parsing by default has cost some performance compared to the v2 branch (see benchmarks), but this is offset by the caching as well as usability improvements such as automatically excluding files that are not `require()`d and automatically including any newly required node_modules.
- Other new features include:
  - improvements to the Express middleware (etags support, gzip support etc.)
  - support for the `browser` field in package json
  - support for source maps (in place of source urls)
  - support for factoring out common dependencies
  - support for file watchers
  - file deduplication: only one copy of a file with the exact same content will be included in the build. Duplicate files are resolved during the build using `file-dedupe`.

## Installation

To install the command line tool globally, run

    npm install -g gluejs

Alternatively, you can run the tool (e.g. via a Makefile) as `./node_modules/gluejs/bin/gluejs`.

## Packaging for the web

Install the starwars npm module and Express:

    npm install gluejs starwars express

Let's create a basic module (`app/index.js`):

    var starwars = require('starwars');

    module.exports = function() {
      return starwars();
    };

Next, set up a basic Express server and use the gluejs middleware:

    var express = require('express'),
        app = express();

    app.use('/app.js', glue.middleware('app/index.js'));

    app.use(express.static('./app'));

    app.listen(3000, function() {
      console.log('Listening on port 3000');
    });

Create basic HTML which loads the bundle and calls the exported function:

    <!DOCTYPE html>
    <html>
    <head>
      <script src="/app.js"></script>
      <script>
        console.log(App()); // call the function exported from app/index.js
        document.body.html = '<h1>' + App() + '</h1>';
      </script>
    </head>
    <body></body>
    </html>

When you open `http://localhost:3000` and open the developer tools console, you should see starwars quotes.

Within the packaged files, require() calls  work just like in Node. Any files and modules required from `app/index.js` or it's dependencies are packaged automatically.

In the browser, only the index files (`app/index.js` in this case) `module.exports` is exposed, and is made available under `window.App` by default (set `--global` to change the name).

By default, gluejs does not export a global "require()" function in the browser; this means that it is compatible with other code since the package is self-contained. If you want to export the require implementation, you can use `--global-require`. If you need to set breakpoints inside files, use `--source-url` to enable source urls.

## CLI / standalone builds

To create same build using the CLI tool, run `npm install -g gluejs` and use the CLI:

    gluejs \
      --include ./app/index.js \
      --global App \
      --out app.js \
      --command 'uglifyjs --no-copyright'

This command also runs the `uglifyjs` minifier to reduce the file size.

The build result is a standalone file, which is exported as a global (`app/index.js` is exposed as `App`). You can use the resulting file in the same way as the in the middleware example, and the resulting file can be redistributed (e.g. to a non-Node web application) without worry as it is fully self-contained.

### Performance comparison with browserify and gluejs

`gluejs` shares a lot of features with browserify (e.g. transform compatibility, dependency parsing), but it uses it's own task execution engine and much more aggressive caching. The following benchmark was run on a Macbook Pro (2013) using a ~1Mb input with ~700 files. I measured the time using the `time` command, using the elapsed time as the metric.

- On an initial attempt, browserify runs out of file handles with EMFILE. Increasing the file limit via `ulimit -n` fixes this issue.

<table>
  <tr>
    <td></td>
    <td>gluejs v3.0</td>
    <td>gluejs v2.3.7</td>
    <td>browserify v3.44.2</td>
  </tr>
  <tr>
    <td>Plain build (no transforms)</td>
    <td>5.40s</td>
    <td>3.72s</td>
    <td>10.37s</td>
  </tr>
  <tr>
    <td>Build w/uglifyjs</td>
    <td>20.70s</td>
    <td>24.16s</td>
    <td>Build fails (too many simultaneous processes).</td>
  </tr>
</table>

Incremental builds:

<table>
  <tr>
    <td></td>
    <td>gluejs v3.0 (w/cache)</td>
    <td>gluejs v2.3.7 (w/cache)</td>
  </tr>
  <tr>
    <td>Plain build (no transforms)</td>
    <td>0.45s</td>
    <td>2.28s</td>
  </tr>
  <tr>
    <td>Build w/uglifyjs</td>
    <td>0.44s</td>
    <td>2.21s</td>
  </tr>
</table>

As you can see, gluejs is quite fast and handles files in way that avoids causing EMFILE.

Note that in build w/uglifyjs, the majority of the time is spent in uglifyjs - the only difference between the two builds is the addition of uglify. gluejs does well with large builds where only a few files have changed between runs thanks to the caching system, which is enabled by default and requires no additional configuration.

You can work around the issue w/too many simultaneous processes that occurs in the browserify build by running uglifyjs separately, but you shouldn't have to do that just to avoid EMFILE / memory limitations and not all transforms will actually work as post-actions.

### Upgrading from v2 to v3

`--include` now works by parsing the dependency graph. If you have a large build with many modules, you'll want to use `--exclude modulename` to exclude modules you don't want in the build. This should make it possible to replicate the v2 behavior.

`--include` and `--exclude` are now resolved slightly differently: they are no longer automatically converted into regular expressions. See the relevant section below.

`--replace` has been deprecated in favor of `--remap`. The distinction between the two (eager vs. late lookup) turned out not to really matter.

`--reset-exclude` is no longer supported due to the new dependency resolution mechanism.

`--source-url` is now called `--source-map`.

### Changelog

For changes made prior to v3.0, check out the [changelog](changelog.md).

## Basic options (CLI, API & middleware)

The `gluejs` CLI tool, the API and the Express middleware accept the same options, so you can easily translate a CLI job into a Node program and vice versa.

You can also easily share configuration by storing the build options in a JSON file, and then using using `--config <path>` in the CLI.

To use the CLI tool, pass options to `gluejs` after installing with `npm install -g gluejs`. To use the API, take a look at the example below:

```javascript
var Glue = require('gluejs');
new Glue()
  .basepath('./lib') // output paths are relative to this
  .include('./lib/index.js')
  .exclude('./lib/foo')
  .remap({
    'jquery': 'window.$ ', // binds require('jquery') to window.$
    'Chat': 'window.Chat'
  })
  .export('App') // the package is output as window.App
  .render(fs.createWriteStream('./out.js'));
```

You can also render e.g. to a http response:

```javascript
res.setHeader('content-type', 'application/javascript');
glue.render(res);
```

Generally, options can be set using call `g.set(key, value)`. You can also pass in a key-value hash, e.g. `.set({ key: value })`, which makes reusing configuration options easier.

A basic `gluejs` run has at least one included file, an output location and a global name.

- `--include <path|name>` / `.include(path|name)` / `.set('include', path|name)`: include a file or package in the build.
- `--out <path>` / `.render(dest)`: file to write. Default: stdout
- `--global <name>` / `.export(name)`: Sets the name of the global variable to export. Default: `App` (e.g. causes the package to be exported under `window.App`).

In `.render(destination)`, the destination can be either a Writable Stream (e.g. a file or a HTTP response) or a callback which accepts `function(err, output){}`.

You can specify paths in three different ways:

- `--include ./path/to/file.js`: include a file and any dependencies.
- `--include ./path/to/dir`: include all files in the directory and all subdirectories.
- `--include package`: include the package named `name` from `node_modules`

The base path for relative paths is controlled via `--basepath <path>` / `.basepath(path)`. All relative paths are appended to this value. This is automatically set to `process.cwd()`, so often you don't need to set it explicitly.

`.json` files are also supported with `--include`; just like in Node, you can use `require('./foo.json')` within the resulting bundle.

### Excluding and ignoring files

Excluding a file removes it completely from the build, which means that `require(file|package)` throws an error if the name cannot be resolved.

To exclude a file, use `--exclude <path|name>` / `.exclude(path|name)` / `.set('exclude', path|name)`. Targets can be paths to files, paths to directories (ignores the directory and all subdirectories) or module names (ignores the whole module). There must be at least one include. Exclusions are applied after inclusions.

When packages or files are excluded, calling `require()` will fall back to any global-scope `require()` implementation if available. For example, given `--exclude jquery`, `require('jquery')` will make a call against `window.require('jquery')`. This lets you split dependencies into multiple bundles - for example, a single bundle with all the shared modules and another bundle with app specific code. It can also be used to integrate with an external loader's require function, like AMD. See the `global-require` and `umd` sections for more information.

Exclusions also support regular expressions. Use `--exclude-regexp <regexp-str>` / `.set('exclude-regexp', str)` to specify a regular expression to exclude. The string is passed to `new RegExp()`. You should quote it in the shell to avoid issues where the shell expands special characters.

Ignoring a file replaces it with an empty object, which means that `require(file|package)` returns `{}`. If a file/package is not needed on the client side and should not be resolved any further, then this is a good option.

To ignore a file, use `--ignore <path|name>` / `.set('ignore', path|name)`.

You may find the following options useful for understanding what gets included/excluded: `--list` (produces a list of the files that have been processed), `--verbose` (enables additional logging) and `--debug` (enables even more verbose logging).


### The cache

If you rerun a previous command, you'll probably notice that the result is returned much faster, usually in under a second.

This is because by default `gluejs` enables a disk-persistent cache; it always checks the cache for a result and handles cache invalidation if the underlying files change. You don't have to do anything to set up or manage the cache, but sometimes you might want to reset it. The default cache location is `~/.gluejs-cache`, and you can safely remove the whole directory to empty the cache.

### API usage

*Methods*. The basic options have their own methods, everything else is configured via `.set(key, value)`. This example lists the main methods:


To render without producing output - for example, to enable eager rebuilding via a watcher - run `.render()` without passing in any parameters.

*Events*. `.render()` returns a Readable Stream which emits the normal readable stream events. It also emits the following additional events:

- Bundle compilation events:
  - `.on('file', function(file) {})`: emitted when a file is added to the bundle with full path to the file
  - `.on('file-hit', function(file) {})`: emitted for each cache hit
  - `.on('file-miss', function(file) {})`: emitted for each cache miss
  - `.on('file-done', function(file, result)) {}`: emitted when a file has been fully processed (e.g. all transforms have run). `result` is a hash containing the information gathered during the parse
  - `error`
  - `done`
  - `etag`

# Reporting

## --log

`--log <level>` enables logging for any messages at `>=` the level, where level is one of (`debug`, `info`, `warn` and `error`).

## --progress

Displays a progress bar.

## --report

Display the summary report. Particularly useful if you are minifying files, since the report will show the file size after transformation.

## --verbose

`--verbose` / `.set('verbose', true)`: More verbose output, such as files being filtered out and processed.

## --silent

`--silent` / `.set('silent', true)`: disable verbose logging

## Middleware features (v3.x)

### Basic middleware usage

`glue.middleware({ include: ... })`: returns a Express/Connect compatible request handler. For example:

    var Glue = requite('gluejs');

    app.use('/js/app.js', Glue.middleware({
      include: __dirname + '/lib'
    }));

Or at the route level:

    app.use(app.router);
    app.get('/js/app.js', Glue.middleware({
      include: __dirname + '/lib'
    }));

You probably want to either use full paths or set `basepath` explicitly to the base path for all relative paths.

Multiple bundles example:

    app.use('/js/deps.js', glue({ include: './client/', 'only-externals': true }));
    // e.g. /js/foo.js => bundle containing ./client/foo.js
    app.use('/js/', glue({ include: './client/', 'no-externals': true }));

### Error messages

*Middleware error messages*: the Express middleware now returns a piece of code which prints an error both in the console and as HTML when the files in the build have syntax errors.

Requires `debug` to be true.

### etags and gzip support

The middleware supports etags in v3.0 and above. This is enabled by default. Each build is associated with a etag, which is sent by the middleware. On subsequent requests, the state of the file system is checked and if nothing has changed, then the middleware can return a 304 Not modified (without any data or any processing beyond the FS checks).

This works by using `glue.set('etag', etag)` before executing the build. If this option is set, then gluejs will emit an etag and return an empty result if everything checks out. The middleware then returns an empty result with 304 Not modified.

To take a look at the results, use `time curl http://localhost/app.js -vvv --header 'If-None-Match: W/etag' > /dev/null` (replacing `W/etag` with the etag you receive from the initial request).

The middleware also supports gzipping. Just pass `gzip: true` as part of the options hash to gzip the build results.

### Using a file watcher

While the etags and gzipping improve performance significantly (~300ms per request), they still require a full file system iteration to ensure that whatever is returned from the cache is up to date.

To speed up builds even further, you can integrate a file watcher library. The task of the file watcher library is simply to track whether the input files have changed. If files have changed, a file system traversal is performed - if not, cached builds can be returned without additional work.

This works by setting `glue.set('clean', true)` and setting the `etag` to the appropriate etag. When clean is true and there is a cached build, then the cached build is reused without requiring a full file system scan.

You can also use the watcher to trigger builds, so that a new build is triggered as soon as files are changed. This speeds up HTTP requests since the build is kicked off much earlier.

You can use your library of choice for the actual file watching. For example, using chokidar for watching:

    ...

### Switching between development and production mode

The following example illustrates how you can write an endpoint which uses the same code path in dev and production. In dev mode, things are rebuilt on demand. In production mode, the builds are performed when first requested, and subsequent requests will simply serve back a static file from a static file directory:

    var opts = {
      include: 'app/index.js'
    };
    var staticFile = __dirname + '/static/app.js';

    app.get('/js/app.js', function(req, res, next) {
      if (isDev) return next(); // always rebuild in dev mode
      res.sendfile(staticFile, function(err) {
        if (!err) return; // sendfile completed successfully
        if (err.code && err.code === 'ENOENT') {
          opts.out = fs.createWriteStream(staticFile);
          return next(); // pass to middleware
        }
        return next(err);
      });
    }, Glue.middleware(opts));

### JSON configuration (--config and --export-config)

You can load configuration from a JSON file using `--config <path>`. This will load the given configuration file, and run the build using the options in the file.

This is useful if you want to reuse the same configuration for a Express middleware build and a command line build.

To create configuration file from an existing build (like a Makefile), add `--export-config` as an option to the build. This will print out a JSON structure representing the current config. Note that you can leave the `basepath` value in the config empty, as it will be automatically resolved to `process.cwd()`.


## Build options

## --source-map

`--source-map` / `.set('source-map', true)`: Source maps are additional annotations that make it possible to show the directory tree when looking at scripts (instead of just the one compiled file):

![screenshot](https://github.com/mixu/gluejs/raw/master/test/sample/sourceurl.png)

#### External source maps

To export source maps to an external file, use [exorcist](https://github.com/thlorenz/exorcist). For example:

    gluejs --include ... | exorcist bundle.js.map > bundle.js

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

## --umd

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

## --remap

To replace a module with a different module in gluejs, use the `remap` option. For example, to bind `require('underscore')` to `window._`, use `--remap underscore="window._"`.

Note that `remap` strings are strings of JS code which are evaluated when `require` calls happen. For example, you can do `--remap underscore="require('lodash')"` to remap underscore to lodash.

### Substituting a file

The [browser field](https://gist.github.com/defunctzombie/4339901) in package.json files is supported via [browser-resolve](https://github.com/defunctzombie/node-browser-resolve)

The `browser` field in package.json is a new addition which allows CommonJS bundlers to replace files which are not compatible with the browser with alternatives provided by the module. You can use this to replace files in your build, and it can also be used by 3rd party modules which support both the browser and Node.

You can replace the whole package with a specific file:

    "browser": "dist/browser.js"

or you can override individual modules and files in `package.json`:

    "browser": {
      "fs": "level-fs",
      "./lib/filters.js": "./lib/filters-client.js"
    },

This will replace `./lib/filters.js` with `./lib/filters-client.js` in the build result.

You can also ignore modules by setting them to `false`:

    "browser": {
      "fs": false,
    },

This has the same effect as `--ignore`: an empty object will be returned when that module is required.

## Minification and source transforms

## --command

`--command <cmd>` / `.set('command', <cmd>)`: Pipe each file through a shell command and capture the output. For example:

    --command "uglifyjs --no-copyright"

For more complicated use cases, you'll probably want to use `--transform`.

## --transform

`--transform <module>`: activates a source transformation module. This enables 3rd party extensions for things that are more complex than just piping through via `--command`.  API-compatible with browserify's [source transformation modules](https://github.com/substack/node-browserify#list-of-source-transforms).

For example, using coffeeify:

    npm install coffeeify
    gluejs --transform coffeeify --include index.coffee > bundle.js

gluejs uses [minitask](https://github.com/mixu/minitask) internally, so you can also write modules that return sync / async functions, Node core duplex / transform streams or Node core child_process objects.

See the [section on writing transform modules](#writing_transform_modules) as well as [this example which uses Square's ES6-module-compiler](https://github.com/mixu/gluejs/blob/glue2/test/command-integration/es6-module.js) and [Jade example](https://github.com/mixu/gluejs/blob/glue2/test/command-integration/jade-module.js) for examples.

If you write a transformation, file a PR against the readme so I can feature it here. I've tested functionality using the examples above, but I haven't published them as modules as it's hard to maintain something I'm not using.

## Optimizing shared modules into a shared file

Often web applications consist of multiple entry points, where each page has some internal workflow that is specific to it as well as some common modules. For these kinds of applications, an optimal build involves making a tradeoff between between the number of requests made and the amount of data transferred.

One fairly easy and decent tradeoff is to split the build into one file that contains the shared set of dependencies, and another one that contains the page-specific code.

After optimization, the common modules should be in a shared package file, and the page-specific modules should be in separate files which make use of the shared package.



How to set up a multi-page gluejs-based project that has the following goals:

- Each page uses a mix of common and page-specific modules.
- All pages share the same gluejs config.
- After an optimization build, the common items should be in a shared common layer, and the page-specific modules should be in a page-specific layer.
- The HTML page should not have to be changed after doing the build.
- The bundles have external sourcemap files associated

Multiple entry point bundles, which make use of a set of shared modules. For example:

- /index.html (index.js): main application
- /admin.html (admin.js): user admin section

You can run a build which produces a file called `shared.js` which contains the modules which are used by both `index.js` and `admin.js`:

    glue({
      include: [ './index.js', './admin.js' ],
      ...
      out: fs.createWriteStream('./shared.js')
    });

Implement `factor-bundle` or equivalent.


To exclude all modules, use `--no-externals`. This option forces the build to only contain files that are not under the `node_modules` folder.


`--no-externals`: this option prevents any modules from under `node_modules` from being included.

`--only-externals`: this option only bundles modules under `node_modules`.


## Performance related options

## --jobs

`--jobs <n>` / `.set('jobs', <n>)`: Sets the maximum level of parallelism for the task execution pipeline. Default: `os.cpus().length * 2`.

## --cache-path

`--cache-path <path>` / `.set('cache-path', <path>)`: Use a specific directory for caching. This is a directory where the results of the previous builds are stored along with metadata. Caching is enabled by default since v2.1.

The default directory is  `~/.gluejs-cache`. You can just delete the directory to invalidate the cache.

Use a directory with a dot in front to hide the cached files (remember to also gitignore the directory). The path is relative to the working directory. For example:

    --cache-path .cache

## --cache-method

`--cache-method <stat|md5|sha512>` / `.set('cache-method', <method>)`: Sets the cache invalidation method. `stat` uses the file size and last modified date of the input file. `md5` (and other hash algorithms supported by `crypto.createHash`) uses hashes to verify that the input file has not changed. Default: stat.

## --no-cache

`--no-cache` / `.set('cache', false)`: Disables the cache; sets the cache directory to a temporary directory.

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

## License

BSD
