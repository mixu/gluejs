var fs = require('fs'),
    path = require('path');

var log = require('minilog')('commonjs-each');

module.exports = function(item, pIndex, index, out, packageObj, opts, totalFiles) {

  var exportVariableName = opts['export'] || 'App',
      filePath = item.filename,
      relativeName = path.relative(packageObj.basepath, filePath),
      moduleName = relativeName;

  // check for renames via opts._rename
  if (opts._rename && opts._rename[filePath]) {
    moduleName = path.relative(packageObj.basepath, opts._rename[filePath]);
  }

  // all dependencies already have a basepath and the names are
  // already relative to it, but this is not true for the main package
  if (pIndex === 0 && moduleName.substr(0, packageObj.basepath.length) == packageObj.basepath) {
    moduleName = moduleName.substr(packageObj.basepath.length);
  }

  // push the task for streaming the file
  return function(done) {
    // each file has:
    // 1. a header
    out.write(JSON.stringify(moduleName) + ': ');

    // 2. wrapper (js / json)
    var wrapJs = (path.extname(filePath) == '.json' ? false : true);

    if (wrapJs) {
      out.write('function(module, exports, require){\n');
      if (opts['source-url']) {
        out.write('eval(');
      }
    } else {
      out.write('function(module, exports, require){\n');
      out.write('module.exports = ');
    }
    // 3. content
    if (wrapJs && opts['source-url']) {
      // wrap content in eval
      out.write(JSON.stringify(chunk.toString()) + '+');
    } else {
      // just read the content
      out.write(fs.readFileSync(item.content));
    }

    if (false) {
      // handle zero-length files
      if (wrapJs) {
      } else {
        out.write('{}');
      }
    }

    if (wrapJs) {
      if (opts['source-url']) {
        // Chrome's inspector has a bug which eats some characters
        // (e.g. lib -> ib and example -> xample)
        // https://code.google.com/p/chromium/issues/detail?id=210421
        // Work around that by prepending /
        this.push(JSON.stringify('\n\/\/@ sourceURL= ' +
          (this.opts['name'].charAt(0) != '/' ? '/' : '') + this.opts['name']) + ');');
      }
      // newline here is important as the last line may be a unterminated comment
      out.write('\n}');
    } else {
      out.write(';\n}');
    }
    // 4. final comma
    // determining when to write the last common becomes easy
    // when files are processed last
    if (index == totalFiles - 1) {
      out.write('\n');
    } else {
      out.write(',\n');
    }
    done();
  };
};
