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

.include(file.json): includes a package.json

.npm(module): includes a npm module from ./node_modules/

.exclude(module): excludes a module from the build completely, replaces it with undefined

.replace(require, code): replaces a module with a piece of code

.export(name): sets the export name

.concat(file): concatenate a file

.render(function(err, text){ ...}): renders the result

