# gluejs

Build CommonJS modules for the browser via a chainable API

### Features

- Build scripts are written directly in Node - easy to customize and add your own processing
- Lightweight, uses same require() implementation as browserbuild
- render() to console, or directly to a HTTP request
- include() files or full directories, blacklist using exclude(regexp)
- watch() the build and rebuild automatically when files change
- Bind variables under window.* to require() statements using replace()
- Compile templating language files to JS via a custom handler
- Source url support
- Virtual packages
- Concatenate multiple packages into one file

## Usage example

```javascript
new Glue()
  .basepath('./lib') // output paths are relative to this
  .include('./lib')  // includes all files in the dir
  .exclude(new RegExp('.+\\.test\\.js')) // excludes .test.js
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
```

## Using the resulting file

To use the resulting file, just include the build result:

    <script src="app.js"></script>
    <script>
      console.log(window.App); // single external interface to the package
    </script>

The require() statements inside the package work just like under Node, yet none of the internals are leaked into the the global namespace.

gluejs does not export a global "require()" function in the browser; this means that it is compatible with other code since all details are hidden and only a single interface is exported (main file's ```module.exports```). The reasons behind this are documented in much more detail in my book, "[Single page applications in depth](http://singlepageappbook.com/maintainability1.html)".

An additional benefit is that you only need one HTTP request to load a package, and that the resulting files can be redistributed (e.g. to a non-Node web application) without worry.

## Including files / directories, excluding by regexp

`.include(path)`: If the path is a file, include it. If the path is a directory, include all files in it recursively.

`.exclude(regexp)`: excludes all files matching the regexp from the build. Evaluated just before rendering the build so it applies to all files.

## Including npm packages

gluejs can also include dependencies from npm. You have to first ```npm install``` the packages, then gluejs reads, wraps and includes them in your build. This is done recursively, so the dependencies of dependencies are also packaged.

`npm(name, [searchFrom])`: includes a single package from a directory. The package is searched from `searchFrom+"/node_modules/"` - the default value for searchFrom is the basepath for the build. The dependency is then available via require(name).

`npm(pathToPackageJson)`: includes all dependencies from the package.json file. Note that things under "devDependencies" are not included. The dependencies are searched starting from pathToPackageJson. Each dependency is accessible via its name.

Sub-dependencies are also automatically bundled, as long as they've been installed by npm. Since the require() semantics are the same as in Node, subdependencies can depend on different versions of the same module without conflicting with each other.

## Setting default values

```javascript
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
```

## Outputting

`.export(name)`: sets the export name (e.g. export('Foo') => window.Foo = require('index.js'); )

`.render(function(err, text){ ...})`: renders the result

## Watching files for changes

`.watch(function(err, text){ ...})`: renders and adds file watchers on the files.

When a file in the build changes, the `watch()` callback will be called again with the new build result.

Note that this API is a bit clunky:

- there is no way to unwatch a file other than terminate the program
- on each watched file change, a console.log() message is shown
- the API uses fs.watchFile(), so you do not get notification of newly added files in directories; watches are registered on the files that were used on the first render

But it works fine for automatically rebuilding e.g. when doing development locally.

# Beyond the basics

Once you get past your first CommonJS-based build, you'll probably want to explore these features:

- Binding variables under window.* to require() statements
- Source URLs
- Handling template files and compile-to-JS files
- Generating modules from JS
- Concatenating multiple packages into one file

## Binding variables under window.* to require() statements

`.replace(module, code)`: Meant for replacing a module with a single variable or expression. Examples:

```javascript
// define require('jquery') as window.$
.replace('jquery', 'window.$');
// define require('debug') as the function below
.replace('debug', function debug() { return debug() });
```

## Source URLs

Source URLs are additional annotations that make it possible to show the directory tree when looking at scripts (instead of just the one compiled file):

![screenshot](https://github.com/mixu/gluejs/raw/master/test/sample/sourceurl.png)

To enable source URLs, set the following option:

```javascript
.set('debug', true)
```

Note that source URLs require that scripts are wrapped in a eval block with a special comment, which is not supported by IE, so don't use source URLs for production builds.

## Handling template files and compile-to-JS files

By default, gluejs only handles files that end with ".js".

You can create custom handlers that handle other types of files, such as templates for your favorite templating language.

To specify a handler, call `handler(regexp, function(opts, done) { ... })`

Here is an example:

```javascript
var Template = require('templating-library');
var extensionRe = new RegExp('(.+)\\.tpl$');
new Glue()
  .include('./fixtures/mixed_content/')
  .handler(extensionRe, function(opts, done) {
    var wrap = opts.wrap, filename = opts.filename;
    var out = Template.precompile(
      fs.readFileSync(filename).toString()
    );
    done(filename.replace(extensionRe, '$1.js'), out);
  })
  .render(function(err, txt) {
    console.log(txt);
    done();
  });
```

In fact, internally, the ".js" extension handler is just:

```javascript
.handler(new RegExp('.*\.js$'), function(opts, done) {
  return done(opts.filename, fs.readFileSync(opts.filename, 'utf8'));
});
```

Handler params:

- first param (regexp): the regexp used to match files.
- second param (callback): a callback(options, done) which will be called for each file.

The callback params:

- first param (options): has the following elements
  - filename: the full path to the file
  - relativeFilename: the file name relative to the gluejs basepath
- second param (done): a callback(string) which should be called with the return value - this allows for async calls inside the handler.

## Virtual packages

Let's assume that your app consists of several internal packages. For example, within your app code you want to refer to the Foo model as require('model').Foo rather than require('../../model/foo.js').

One way to do this would be to simply have multiple packages, App and Models - where models exports window.model. If you prefer to avoid that extra global variable, do this instead:

```javascript
.define('model', 'require("./model")');
```

Don't use require('model') in files inside the ./model directory, since that may introduce a circular dependency (e.g. model/a -> model/index -> model/a).

## Generating modules from JS

`.define(module, code)`: Meant for writing a full module. The difference here is that while replace() code is not wrapped in a closure while define() code is.

```javascript
.define('index.js', [ 'module.exports = {',
  [ (hasBrowser ? "  browser: require('./backends/browser_console.js')" : undefined ),
    (hasLocalStorage ? "  localstorage: require('./backends/browser_localstorage.js')" : undefined )
  ].filter(function(v) { return !!v; }).join(',\n'),
'};'].join('\n'));
```

The example above generates a index.js file depending on hasBrowser and hasLocalStorage.

## Concatenating multiple packages into one file

Glue.concat([ package, package ], function(err, txt)). For example:

```javascript
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
```

## A few notes about npm dependencies

The main file is determined by looking at the "main" key in package.json and resolution follows the require() rules as documented in the Node API docs.

Only files ending with .js are included in the builds, since require() only works with .js, .json and .node files (the last one being for compiled native modules).

The .npmignore file is honored. It works like a .gitignore file. This is the preferred way of excluding files and directories from npm dependencies according to ```man npm developers```.
