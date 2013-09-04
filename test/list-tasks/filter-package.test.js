var assert = require('assert'),
    util = require('util');

var infer = require('../../lib/list-tasks/infer-packages.js'),
    filter = require('../../lib/list-tasks/filter-packages.js');

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
  },

  'package.json devDependencies': {
    files: [
      '/a/index.js',
      '/a/node_modules/bar/index.js',
      '/a/node_modules/bar/package.json',
      '/a/node_modules/bar/node_modules/include_me.js',
      '/a/node_modules/bar/node_modules/exclude_me.js',
      '/a/node_modules/bar/node_modules/include/second.js',
      '/a/node_modules/bar/node_modules/exclude/second.js',
      '/a/node_modules/bar/node_modules/exclude/node_modules/subdependency.js',
    ],
    fakeFS: {
      '/a/node_modules/bar/package.json': JSON.stringify({
        devDependencies: {
          exclude_me: '*',
          exclude: '*'
        }
      })
    }
  }
};

Object.keys(cases).forEach(function(name) {
  cases[name].files = cases[name].files.map(function(file) { return { name: file }; });
});

exports['filter-package'] = {

  before: function() {
    var self = this;

    function mock(filename) {
      if(self.fakeFS[filename]) {
        return self.fakeFS[filename];
      }
      console.log('fs.readFileSync', filename);
      return '{}';
    }

    infer._setFS({
      readFileSync: mock
    });

    filter._setFS({
      readFileSync: mock
    });
  },

  'can exclude via package.json whitelist': function() {
    var list = cases['package.json whitelist'];
    this.fakeFS = list.fakeFS;
    // first, infer the package structure
    infer(list);
    // now apply the filter
    filter(list);
    // console.log(util.inspect(list, null, 10, true));
    assert.deepEqual(list.files, [
      { name: '/a/included_file.js' },
      { name: '/a/included_file.foobar' },
      { name: '/a/included_directory/bbb.js' },
      { name: '/a/included_directory/ccc/ddd.js' },
    ]);
  },

  'can exclude via .npmignore': function() {
    var list = cases['npmignore blacklist'];
    this.fakeFS = list.fakeFS;
    // first, infer the package structure
    infer(list);
    // now apply the filter
    filter(list);
    // console.log(util.inspect(list, null, 10, true));
    assert.deepEqual(list.files, [
      { name: '/a/included_file.js' },
      { name: '/a/included_file.foobar' },
      { name: '/a/.npmignore' },
      { name: '/a/included_directory/bbb.js' }
    ]);

  },

  'packages listed in package.json as devDependencies are ignored': function() {
    var list = cases['package.json devDependencies'];
    this.fakeFS = list.fakeFS;
    // first, infer the package structure
    infer(list);
    // now apply the filter
    filter(list);
    // console.log(util.inspect(list, null, 10, true));
    assert.deepEqual(list.files, [
     { name: '/a/index.js' },
     { name: '/a/node_modules/bar/index.js' },
     { name: '/a/node_modules/bar/package.json' },
     { name: '/a/node_modules/bar/node_modules/include_me.js' },
     { name: '/a/node_modules/bar/node_modules/include/second.js' }
    ]);
    // base package, bar, include and include_me = 4 packages
    assert.equal(list.packages.length, 4);
  }

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
