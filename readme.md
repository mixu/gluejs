# Examples

    Glue
      .include('./lib')
      .global({
        'jquery': 'window.$',
        'Chat': 'window.Chat'
      })
      .export('App');

    Glue
      .include('../core/package.json')
      .exclude('mocha')
      .replace('miniee', )
      .replace('debug', function(name) {
        console.log('name', arguments);
      })
      .export('Core');


## API

.include(directory): recursively includes files in the directory

.include(file): includes a single file

.replace(module, code): replaces a module or global with a piece of code

.exclude(regexp): excludes a path from the build completely

.export(name): sets the export name

.render(function(err, text){ ...}): renders the result

## TODO

.npm(file.json): includes a package.json
