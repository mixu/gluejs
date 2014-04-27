var fs = require('fs'),
    path = require('path');

var log = require('minilog')('commonjs-each'),
    forEachFile = require('./for-each-file.js');

module.exports = function(out, packageObj, pIndex, opts) {
  var tasks = [],
      files = packageObj.files;

  // write the package header
  tasks.push(function(done) {
    // out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');
    log.info('Processing package:', (packageObj.name ? packageObj.name : 'root'));
    out.write('r.m[' + pIndex + '] = {\n');
    // TODO: store replaced and remapped for all packages

    // store dependency references
    /*
    Object.keys(packageObj.dependenciesById).forEach(function(name) {
      var uid = packageObj.dependenciesById[name],
          index;

      // find the package in the (possibly altered) packages list by unique id
      list.packages.some(function(item, itemIndex) {
        var match = (item.uid == uid);
        if (match) {
          index = itemIndex;
        }
        return match;
      });

      // r.m[n]['foo'] = { c: 1, m: 'lib/index.js' }
      out.write(
        JSON.stringify(name) + ': ' + JSON.stringify({
          c: index,
          m: list.packages[index].main
        }));
      out.write(',\n');
    });
  */

    done();
  });

  // stream each file in serial order
  var totalFiles = files.length;
  files.forEach(function(item, index) {
    tasks = tasks.concat(forEachFile(item, pIndex, index, out, packageObj, opts, totalFiles));
  });

  // write the package footer
  tasks.push(function(done) {
    out.write('};\n');
    done();
  });

  return tasks;
};
