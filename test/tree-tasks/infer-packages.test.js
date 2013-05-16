var assert = require('assert'),
    util = require('util');

var infer = require('../../lib/tree-tasks/infer-packages.js');

var cases = {

  'single-file': {
    files: [ '/fixtures/simple.js' ]
  },

  'has-node-module-file': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/foo.js'
    ]
  },

  'has-node-module-folder': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/foo/index.js',
      '/fixtures/node_modules/foo/other.js',
      '/fixtures/node_modules/foo/lib/sub.js'
    ]
  },

  'has-node-module-folder-mainfile-via-package-json': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/foo/main.js',
      '/fixtures/node_modules/foo/other.js',
      '/fixtures/node_modules/foo/lib/sub.js',
      '/fixtures/node_modules/foo/package.json'
    ]
  },

  'has-sub-sub-module': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/foo/index.js',
      '/fixtures/node_modules/foo/other.js',
      '/fixtures/node_modules/foo/lib/sub.js',
      '/fixtures/node_modules/foo/node_modules/bar/index.js'
    ]
  },

  'has-sub-sub-sub-module': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/aa/index.js',
      '/fixtures/node_modules/aa/node_modules/bb.js',
      '/fixtures/node_modules/aa/node_modules/cc/index.js'
    ]
  }

};

exports['can infer the package structure'] = {

  'single-file': function() {
    var tree = { files: cases['single-file'].files.map(function(file) { return { name: file }; }) };

    infer(tree);

    console.log(util.inspect(tree, null, 10, true));
  }

};




// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
