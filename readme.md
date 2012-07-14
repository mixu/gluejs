# gluejs

A CommonJS-based build system with a chainable API

### Features

- Build scripts are written directly in Node - easy to customize and add your own processing
- Lightweight, uses same require() implementation as browserbuild
- render() to console, or directly to a HTTP request
- include() files or full directories, blacklist using exclude(regexp)
- watch() the build and rebuild automatically when files change
- Bind variables under window.* to require() statements using replace()
- Compile templating language files to JS via a custom handler
- Concatenate multiple packages into one file

## Usage example

    new Glue()
      .basepath('./lib') // output paths are relative to this
      .include('./lib')  // includes all files in the dir
      .exclude(new RegExp('.+\.test\.js')) // excludes .test.js
      .replace({
        'jquery': 'window.$', // binds require('jquery') to window.$
        'Chat': 'window.Chat'
      })
      .export('App') // the package is output as window.App
      .render(function (err, txt) {
        // send the package as a response to a HTTP request
        res.setHeader('content-type', 'application/javascript');
        res.end(txt);
        // or write the result to a file
        fs.writeFile('./app.js', txt);
      });

## Including files / directories, excluding by regexp

```include(path)```: If the path is a file, include it. If the path is a directory, include all files in it recursively.

```exclude(regexp)```: excludes all files matching the regexp from the build. Evaluated just before rendering the build so it applies to all files.

## Setting default values

    .defaults({
      // all relative include() paths are resolved relative to this path
      reqpath: '',

      // strip this string from each path
      // (e.g. /foo/bar/baz.js with '/foo' becomes 'bar/baz.js')
      basepath: '',

      // main file, preset default is index.js
      main: 'index.js',

      // name for the variable under window to which the package is exported
      export: '',

      // binds require('jquery') to window.$
      replace: { 'jquery': 'window.$' }
    })

## Outputting

```.export(name)```: sets the export name (e.g. export('Foo') => window.Foo = require('index.js'); )

```.render(function(err, text){ ...})```: renders the result

## Watching files for changes

```.watch(function(err, text){ ...})```: renders and adds file watchers on the files.

When a file in the build changes, the ```watch()``` callback will be called again with the new build result.

Note that this API is a bit clunky:

- there is no way to unwatch a file other than terminate the program
- on each watched file change, a console.log() message is shown
- the API uses fs.watchFile(), so you do not get notification of newly added files in directories; watches are registered on the files that were used on the first render

But it works fine for automatically rebuilding e.g. when doing development locally.

# Beyond the basics

Once you get past your first CommonJS-based build, you'll probably want to explore these features:

- Binding variables under window.* to require() statements
- Handling template files and compile-to-JS files
- Generating modules from JS
- Concatenating multiple packages into one file

## Binding variables under window.* to require() statements

```replace(module, code)```: Meant for replacing a module with a single variable or expression. Examples:

    // define require('jquery') as window.$
    .replace('jquery', 'window.$');
    // define require('debug') as the function below
    .replace('debug', function debug() { return debug() });

## Handling template files and compile-to-JS files

By default, gluejs only handles files that end with ".js".

You can create custom handlers that handle other types of files, such as templates for your favorite templating language.

To specify a handler, call ```handler(regexp, function(opts, done) { ... })```

Here is an example:

    var Template = require('templating-library');
    var extensionRe = new RegExp('(.+)\.tpl$');
    new Glue()
      .include('./fixtures/mixed_content/')
      .handler(extensionRe, function(opts, done) {
        var wrap = opts.wrap, filename = opts.filename;
        var out = Template.precompile(
          fs.readFileSync(filename).toString()
        );
        done(wrap(filename.replace(extensionRe, '$1.js'), out));
      })
      .render(function(err, txt) {
        console.log(txt);
        done();
      });

In fact, internally, the ".js" extension handler is just:

    .handler(new RegExp('.*\.js$'), function(opts, done) {
      return done(opts.wrap(opts.filename,
          fs.readFileSync(opts.filename, 'utf8')));
    });

Handler params:

- first param (regexp): the regexp used to match files.
- second param (callback): a callback(options, done) which will be called for each file.

The callback params:

- first param (options): has the following elements
  - filename: the full path to the file
  - relativeFilename: the file name relative to the gluejs basepath
  - wrap: a function(filename, content) which wraps the content string inside a anonymous function, just like normal JS files.
- second param (done): a callback(string) which should be called with the return value - this allows for async calls inside the handler.

## Generating modules from JS

```define(module, code)```: Meant for writing a full module. The difference here is that while replace() code is not wrapped in a closure while define() code is.

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

## TODO

Virtual packages

.npm(file.json): includes a package.json
