var fs = require('fs'),
    runner = require('../runner.js');

// this runner concatenates the files to stdout after running wrap-commonjs-web
module.exports = function(tree, options) {
  var current = 0;

  // annotate with tree-level tasks

  // - generate `.packages` from `.files` (by grouping the set of `.files` into distinct dependencies)
  //   ... and infer the package main file

  // - for each package, apply excludes


  // annotate with file-level tasks
  annotateWithTask(tree, [
    require('../file-tasks/wrap-commonjs-web.js')
  ]);

  // run tree level tasks

  // produce the file
  var output = '';

  // top level boundary
  output += '(function(){';
  // the require() implementation
  output += fs.readFileSync(__dirname + './resources/require.new.min.js');
  // the registry definition
  output += '\nrequire.m = [];\n';

  // for each module, write `require.m[n] = { normalizedName: .. code .. , };`

  // export the package root into `window`
  output += exportVariableName + ' = require(\'' +  packageRootFileName + '\');';
  // finally, close the package file
  output += '}());';

  console.log(tree);
  console.log(output);
};
