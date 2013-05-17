var assert = require('assert'),
    util = require('util');

var infer = require('../../lib/tree-tasks/infer-packages.js'),
    filter = require('../../lib/tree-tasks/filter-packages.js');

var cases = {

  'package.json whitelist' : { files: [
      '/a/excludeme.js',
      '/a/included_file.js',
      '/a/included_file.foobar',
      '/a/package.json',
      '/a/excluded_directory/aaa.js',
      '/a/included_directory/bbb.js',
      '/a/included_directory/ccc/ddd.js'
    ],
    fakeFS: {
      '/a/package.json': JSON.stringify({
        files: [
          '/a/included_directory',
          '/a/included_file.js',
          '/a/included_file.foobar'
        ]
      })
    }
  },

  'npmignore blacklist': {
    files: [
      '/a/excludeme.js',
      '/a/foo.excludeme',
      '/a/included_file.js',
      '/a/included_file.foobar',
      '/a/.npmignore',
      '/a/included_directory/bbb.js',
      '/a/included_directory/excluded_sub/ddd.js',
      '/a/examples/file',
      '/a/exclude/file',
      '/a/test/file',
      '/a/docs/file',
      '/a/glob/file'
    ],
    // to be honest, the way in which glob matching works in npm is quite nutty
    // https://github.com/isaacs/fstream-ignore/blob/master/ignore.js
    // e.g. trying multiple variants of the same path, recursively against the same rule
    //
    // My goal here is to 1) use the same underlying expression compiler (isaacs/minimatch)
    // and 2) to test that the most common cases are covered.
    fakeFS: {
      '/a/.npmignore':
        // should strip comments
        '# Comment\n' +
        // specific file
        '/a/excludeme.js\n' +
        // specific extension
        '*.excludeme\n'+
        // specific directory (all four permutations)
        'test\n' +
        '/exclude\n' +
        'docs/\n' +
        '/examples/\n' +
        // glob "dir/*"
        'glob/*\n' +
        // glob "dir/*/**"
        'included_directory/*/**\n'
    }
  }
};

Object.keys(cases).forEach(function(name) {
  cases[name].files = cases[name].files.map(function(file) { return { name: file }; });
});

exports['filter-package'] = {

  before: function() {
    var self = this;
    filter._setFS({
      readFileSync: function(filename) {
        if(self.fakeFS[filename]) {
          return self.fakeFS[filename];
        }
        console.log('fs.readFileSync', filename);
        return '{}';
      }
    });
  },

  'can exclude via package.json whitelist': function() {
    var tree = cases['package.json whitelist'];
    this.fakeFS = tree.fakeFS;
    // first, infer the package structure
    infer(tree);
    // now apply the filter
    filter(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.deepEqual(tree.files, [
      { name: '/a/included_file.js' },
      { name: '/a/included_file.foobar' },
      { name: '/a/included_directory/bbb.js' },
      { name: '/a/included_directory/ccc/ddd.js' },
    ]);
  },

  'can exclude via .npmignore': function() {
    var tree = cases['npmignore blacklist'];
    this.fakeFS = tree.fakeFS;
    // first, infer the package structure
    infer(tree);
    // now apply the filter
    filter(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.deepEqual(tree.files, [
      { name: '/a/included_file.js' },
      { name: '/a/included_file.foobar' },
      { name: '/a/.npmignore' },
      { name: '/a/included_directory/bbb.js' }
    ]);

  },
/*
  'test minimatch': function() {
    var minimatch = require("minimatch");
    var expr = 'a/*' + '/**';
    console.log(minimatch('a/b', expr, { matchBase: true, dot: true, flipNegate: true }));
    console.log(minimatch('a/exlc/c', expr, { matchBase: true, dot: true, flipNegate: true }));
    console.log(minimatch('a/exlc/two/c', expr, { matchBase: true, dot: true, flipNegate: true }));
    expr = 'a/';
    console.log(minimatch('a/b', expr, { matchBase: true, dot: true, flipNegate: true }));
    console.log(minimatch('a/exlc/c', expr, { matchBase: true, dot: true, flipNegate: true }));
    console.log(minimatch('a/exlc/two/c', expr, { matchBase: true, dot: true, flipNegate: true }));
  }
*/
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
