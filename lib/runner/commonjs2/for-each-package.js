var fs = require('fs'),
    path = require('path');

var log = require('minilog')('commonjs-each'),
    forEachFile = require('./for-each-file.js');

module.exports = function(out, packageObj, pIndex, opts, packagesByName) {
  var tasks = [],
      files = packageObj.files;

  // assert that uid = pIndex
  if (typeof packageObj.uid != 'undefined' && pIndex != packageObj.uid) {
    throw new Error('Unexpected uid for ' + pIndex + ': ' + JSON.stringify(packageObj));
  }

  // write the package header
  tasks.push(function(done) {
    // out.write('/* -- ' + (packageObj.name ? packageObj.name : 'root') + ' -- */\n');
    log.info('Processing package:', (packageObj.name ? packageObj.name : 'root'));
    out.write('r.m[' + pIndex + '] = {\n');

    // store dependency references
    packageObj.deps.forEach(function(name) {
      // store remapped references. but only if referenced
      if(opts.remap && opts.remap[name]) {
        out.write(
          JSON.stringify(name) + ': ' +
            'function(module, exports, require) { module.exports = ' + opts.remap[name] + ' }');
        out.write(',\n');
        return;
      }
      if(!packagesByName || !packagesByName[name]) {
        log.warn('Could not find dependency "' + name + '" in ' +
          (packageObj.name ? packageObj.name : 'root'));
        return;
      }

      var otherPkg = packagesByName[name];
      // r.m[n]['foo'] = { c: 1, m: 'lib/index.js' }
      out.write(
        JSON.stringify(name) + ': ' + JSON.stringify({
          c: otherPkg.uid,
          m: otherPkg.main
        }));
      out.write(',\n');
    });

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
