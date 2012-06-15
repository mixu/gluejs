# gluejs - features

- Build scripts are written directly in Node, allowing for more optimized builds
- lightweight, uses same require() implementation as browserbuild
- render() to console, or directly to a HTTP request
- include() any files or directories and blacklist by regexp using exclude()
- replace() any library with one that gets looked up from under window.* (e.g. require('jquery') => window.$)
- watch() the build and get notified when files in it change
- define() any dependency as a block of code that you generate (e.g. for creating builds that export a subset of functionality)
- concat() multiple packages into one build (e.g. where your final build consists of multiple files)
- TODO npm() build from a package.json and apply .npmignore

# Examples

## Usage (http server)

    new Glue()
      .basepath('./lib')
      .include('./lib')
      .replace({
        'jquery': 'window.$',
        'Chat': 'window.Chat'
      })
      .export('App')
      .render(function (err, txt) {
        res.setHeader('content-type', 'application/javascript');
        res.end(txt);
      });

## Usage (http server)

    new Glue()
      .include('./core')
      .exclude('mocha')
      .replace('debug', function(name) {
        console.log('name', arguments);
      })
      .export('Core')
      .watch(function (err, txt) {
        fs.writeFile('./core.js', txt);
      });


## Including files / directories, excluding by regexp

include(path): If the path is a file, include it. If the path is a directory, include all files in it recursively.

exclude(regexp): excludes all files matching the regexp from the build. Evaluated just before rendering the build so it applies to all files.

## Setting default values

    .defaults({
      reqpath: '/path/to/first/module/to/require/glue', // all relative paths are relative to this
      basepath: '', // strip this string from each path (e.g. /foo/bar/baz.js with '/foo' becomes 'bar/baz.js')
      main: 'index.js', // main file, preset default is index.js
      export: '', // name for the variable under window to which the package is exported
      replace: { 'jquery': 'window.$' } // require('jquery') should return window.$
    })

## Outputting

.export(name): sets the export name

.render(function(err, text){ ...}): renders the result

## Replacing and defining code

replace(module, code): Meant for replacing a module with a single variable or expression. Examples:

    .replace('jquery', 'window.$'); // require('jquery') will return the value of window.$
    .replace('debug', function debug() { return debug() }); // code is converted to string

define(module, code): Meant for writing a full module. The difference here is that while replace() code is not wrapped in a closure while define() code is.

    .define('index.js', [ 'module.exports = {',
      [ (hasBrowser ? "  browser: require('./backends/browser_console.js')" : undefined ),
        (hasLocalStorage ? "  localstorage: require('./backends/browser_localstorage.js')" : undefined )
      ].filter(function(v) { return !!v; }).join(',\n'),
    '};'].join('\n'));

The example above generates a index.js file depending on hasBrowser and hasLocalStorage.

## Concatenating multiple builds

Glue.concat([ package, package ], function(err, txt)). For example:

    var packageA = new Glue()
          .basepath('./fixtures/')
          .export('Foo')
          .include('./fixtures/lib/foo.js');
    var packageB = new Glue()
          .basepath('./fixtures/')
          .export('Bar')
          .include('./fixtures/lib/bar.js');

    Glue.concat([packageA, packageB], function(err, txt) {
      console.log(txt);
    });

## Watching a single build

.watch(function(err, text){ ...})

Renders the result and adds file watchers on the dependent files.

When the file changes, the callback will be called again, with the newly rendered version.

Note that this API is a bit clunky:

- there is no way to unwatch a file other than terminate the program
- on each watched file change, a console.log() message is shown
- the API uses fs.watchFile(), so you do not get notification of newly added files in directories; watches are registered on the files that were used on the first render

But it works fine for automatically rebuilding e.g. in dev.

## TODO

.npm(file.json): includes a package.json
