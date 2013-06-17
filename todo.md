# Todo

# Known issues

- setting basepath to ./node_modules/foo causes the root to be empty rather than being based inside the package directory. E.g. you need to do require('foo') to get the result rather than require('./index.js');
- replace('foo', 'window.foo') applies to all subdependencies indiscriminately. Need a better syntax to control this. Old behavior was to only replace top level dependencies.

# Tasks

- pre-filters for .git / svn / hg / cvs directories for better performance
- attach the stat information during the tree traversal to avoid double stats
- better metadata fetching from package.json
  - it should be possible to pre-filter the packages (before infer packages),
    so that devDependencies are not included in the processing
  - version numbers should be fetched
- ability to remap paths
  - e.g. add a file to the root from outside the root, with a different virtual filename
  - e.g. swap out the content a directory for the content of another one (shimming)
- better logging (e.g. during filtering)

# Internals

Phases:

- acquire file paths (e.g. via calls to .include and .npm)
    => result is a tree { files: [] } (under basepath)
    => note that nothing is excluded here
- filter file paths (e.g. remove excluded, remove .npmignore and so on)
- attach tasks
- run tasks
- squash result (or save to a directory)

Pre-task:

- acquire => e.g. convert inputs to a tree of files
- read

File tasks:

- run-shell (e.g. run uglify)
- wrap-commonjs-web (e.g. wrap inside a function call)
- wrap-commonjs-web-sourceurl
- wrap-commonjs-amd (e.g. take commonJS files, resolve their direct dependencies, wrap into an AMD module)
- wrap-amd-commonjs-web (e.g. take a AMD file, look at the dependency declaration, convert that to a string, wrap into a web-commonjs module)

Tree tasks:

- annotate-basepath
- annotate-stat
- annotate-structured
- annotate-with-task
- annotate-main-file

- filter-regex
- filter-npm
- filter-packages


Final tasks:

- concatenate
- static-server (e.g. serve over http)
- package-commonjs (to any writable stream)


New features:

- vastly better conventions and support for writing dual-platform (browser + server) code that has some functions replaced with platform-specific equivalents
- Mocha test server and conventions to make it easy to repackage and run your Mocha tests inside a browser
- static file serving and Connect middleware
- better AMD interoperability: hook into AMD if that's the system being used; optionally export a `require()` implementation

Minor, but cool features:

- interoperate with libraries that use globals by binding variables under window.*
- continous rebuild via watcher
- build non-JS resources, for example compile Jade and Handlebars templates
- sourceURL support
- custom build task support
- better support for .npmignore files and filtering in general
- choice between throwing, or returning undefined in the require shim

# How do I ...?

## How do I build a single package from a existing Node.js project?

The easiest way is to use the command line tool:

    gluejs --out dist/radar_client.js

This auto-detects the package name and main file, and bundles the content of the current directory and subdirectories as well as any npm modules in them.

You can override this by explictly passing in various options - for example, if you only want to include the content of a single directory.

## How do I integrate gluejs with my web app so that things are built automatically?

You can use the API - and there is builtin Connect middleware if you're using Connect.

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



