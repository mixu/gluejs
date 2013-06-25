# gluejs

Build CommonJS modules for the browser via a chainable API.

New and improved gluejs v2.

## What's new in v2

gluejs (v2) is a comprehensive refactoring to make use of Node 0.10.x -style streams (under 0.8.x via [readable-stream](https://github.com/isaacs/readable-stream)).

- internals refactored to make working with unix pipes (e.g. minification, obfuscation etc.) much easier via Node 0.10.x streams
- internals refactored to make file operation easier to apply (e.g. each task is separated into it's own pipe)

Warning! Dragons! gluejs2 is still under development. It works well enough that I use it for our own builds but you may run into small issues and I haven't had the time to fully document it. Please report issues if you run into them.

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
        [filename]              [original size] [% of total] -> [size after minification] (savings in bytes and % of original)

The `.npmignore` and `package.json` exclude logic is now more accurate, leading to smaller builds.

Silent logging via `--silent`.

Source url annotations via `--source-url`.

Ability to export a global require via `--global-require`. Overwrites / exports the require implementation from the package, allowing you to call require() from outside the package as if you were inside the package.

Ability to export the module via `--amd` using the require.js AMD define("name", ...) with the name specified in --global. Note that the requirejs will not pick up modules defined like this unless you do at least one asynchronous require() call, e.g. `require(['foo'], function(foo){ });` is needed before `require('foo')` will work. This seems to be a quirk in the AMD shim.

## Upgrading

`gluejs --include foo bar` has to be written as `gluejs --include foo --include bar`.

## Usage

````bash
Usage: node ./bin/gluejs --include <file/dir ...> --out filename.js

Options:
  --include         Path to import.
  --exclude         JS regular expression string to match against the included paths
  --out             File to write. Default: stdout
  --global          Name of the global to export. Default: "Foo"
  --basepath        Base path for the list of files. Default: process.cwd().
  --main            Name of the main file/module to export. Default: index.js
  --replace         Bind require("name") to the expression, e.g. jQuery to window.$.
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
