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
      '/fixtures/node_modules/foo/lib/sub.js'
    ]
  },

  'has-node-module-folder-mainfile-via-package-json': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/foo/main.js',
      '/fixtures/node_modules/foo/lib/sub.js',
      '/fixtures/node_modules/foo/package.json'
    ],
    fakeFS: {
      '/fixtures/node_modules/foo/package.json': JSON.stringify({
        main: 'main.js'
      })
    }
  },

  'has-sub-sub-sub-module': {
    files: [
      '/fixtures/index.js',
      '/fixtures/node_modules/aa/index.js',
      '/fixtures/node_modules/aa/node_modules/bb.js',
      '/fixtures/node_modules/aa/node_modules/cc/differentfile.js',
      '/fixtures/node_modules/aa/node_modules/cc/package.json'
    ],
    fakeFS: {
      '/fixtures/node_modules/aa/node_modules/cc/package.json': JSON.stringify({
        main: 'differentfile.js'
      })
    }
  },

  'json-node-module': {
    files: [
      '/a/index.js',
      '/a/node_modules/b.json'
    ]
  },

  'package-json-guess-extension': {
    files: [
      '/a/index.js',
      '/a/node_modules/b/alt.js',
      '/a/node_modules/b/package.json'
    ],
    fakeFS: {
      '/a/node_modules/b/package.json': JSON.stringify({
        main: 'alt'
      })
    }
  },

  'package-json-guess-directory': {
    files: [
      '/a/index.js',
      '/a/node_modules/b/lib/index.js',
      '/a/node_modules/b/package.json'
    ],
    fakeFS: {
      '/a/node_modules/b/package.json': JSON.stringify({
        main: './lib/'
      })
    }
  },

  'package-json-relpath': {
    files: [
      '/a/index.js',
      '/a/node_modules/b/lib/foo/bar/alt.js',
      '/a/node_modules/b/package.json'
    ],
    fakeFS: {
      '/a/node_modules/b/package.json': JSON.stringify({
        main: './lib/foo/../foo/bar/alt.js'
      })
    }
  },

};

Object.keys(cases).forEach(function(name) {
  cases[name].files = cases[name].files.map(function(file) { return { name: file }; });
});

exports['can infer the package structure'] = {

  before: function() {
    var self = this;
    infer._setFS({
      readFileSync: function(filename) {
        if(self.fakeFS[filename]) {
          return self.fakeFS[filename];
        }
        console.log('fs.readFileSync', filename);
        return '{}';
      }
    });
  },


  'can infer a single-file package': function() {
    var tree = cases['single-file'];
    infer(tree);
    // console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 1);
    // the root (or base) package should be anonymous (=> name is given by the user)
    assert.ok(typeof tree.packages[0].name == 'undefined');
    assert.ok(typeof tree.packages[0].basepath == 'undefined');
    assert.ok(typeof tree.packages[0].mainfile == 'undefined');
    // the package files should be correct
    assert.deepEqual(tree.packages[0].files, [ '/fixtures/simple.js' ]);
  },

  'can infer two packages from module-file and detect the right main file': function() {
    var tree = cases['has-node-module-file'];
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    // the root (or base) package should be anonymous (=> name is given by the user)
    assert.ok(typeof tree.packages[0].name == 'undefined');
    // the package files should be correct
    assert.deepEqual(tree.packages[0].files, [ '/fixtures/index.js' ]);
    assert.deepEqual(tree.packages[0].dependencies, { foo: 1 });

    // foo package
    assert.equal(tree.packages[1].name, 'foo');
    assert.equal(tree.packages[1].basepath, '/fixtures/node_modules/');
    assert.equal(tree.packages[1].mainfile, 'foo.js');
    assert.deepEqual(tree.packages[1].files, [ 'foo.js' ]);
    assert.deepEqual(tree.packages[1].dependencies, { });
  },

  'can infer two packages from module-folder': function() {
    var tree = cases['has-node-module-folder'];
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    // the root (or base) package should be anonymous (=> name is given by the user)
    assert.ok(typeof tree.packages[0].name == 'undefined');
    // the package files should be correct
    assert.deepEqual(tree.packages[0].files, [ '/fixtures/index.js' ]);
    assert.deepEqual(tree.packages[0].dependencies, { foo: 1 });

    // foo package
    assert.equal(tree.packages[1].name, 'foo');
    assert.equal(tree.packages[1].basepath, '/fixtures/node_modules/foo/');
    assert.equal(tree.packages[1].mainfile, 'index.js');
    assert.deepEqual(tree.packages[1].files, [ 'index.js', 'lib/sub.js' ]);
    assert.deepEqual(tree.packages[1].dependencies, { });
  },

  'can pick up main file name from package.json': function() {
    var tree = cases['has-node-module-folder-mainfile-via-package-json'];

    // set up fakeFS
    this.fakeFS = tree.fakeFS;

    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    // the root (or base) package should be anonymous (=> name is given by the user)
    assert.ok(typeof tree.packages[0].name == 'undefined');
    // the package files should be correct
    assert.deepEqual(tree.packages[0].files, [ '/fixtures/index.js' ]);
    assert.deepEqual(tree.packages[0].dependencies, { foo: 1 });

    // foo package
    assert.equal(tree.packages[1].name, 'foo');
    assert.equal(tree.packages[1].basepath, '/fixtures/node_modules/foo/');
    assert.equal(tree.packages[1].mainfile, 'main.js');
    assert.deepEqual(tree.packages[1].files, [ 'main.js', 'package.json', 'lib/sub.js' ]);
    assert.deepEqual(tree.packages[1].dependencies, { });
  },

  'can pick up recursive node_modules': function(){
    var tree = cases['has-sub-sub-sub-module'];
    // set up fakeFS
    this.fakeFS = tree.fakeFS;
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 4);
    assert.deepEqual(tree.packages, [
      { files: [ '/fixtures/index.js' ], dependencies: { aa: 1 } },
      { name: 'aa',
        basepath: '/fixtures/node_modules/aa/',
        mainfile: 'index.js',
        files: [ 'index.js' ],
        dependencies: { bb: 2, cc: 3 } },
      { name: 'bb',
        basepath: '/fixtures/node_modules/aa/node_modules/',
        mainfile: 'bb.js',
        files: [ 'bb.js' ],
        dependencies: {} },
      { name: 'cc',
        basepath: '/fixtures/node_modules/aa/node_modules/cc/',
        mainfile: 'differentfile.js',
        files: [ 'differentfile.js', 'package.json' ],
        dependencies: {} }
    ]);
  },

  'can resolve single .json file npm module': function() {
    var tree = cases['json-node-module'];
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    assert.deepEqual(tree.packages, [
      { files: [ '/a/index.js' ], dependencies: { b: 1 } },
      { name: 'b',
        basepath: '/a/node_modules/',
        mainfile: 'b.json',
        files: [ 'b.json' ],
        dependencies: {} }
    ]);
  },

  'it should be OK to define the main file without the .js extension': function() {
    var tree = cases['package-json-guess-extension'];
    // set up fakeFS
    this.fakeFS = tree.fakeFS;
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    assert.deepEqual(tree.packages, [
      { files: [ '/a/index.js' ], dependencies: { b: 1 } },
      { name: 'b',
        basepath: '/a/node_modules/b/',
        mainfile: 'alt.js',
        files: [ 'alt.js', 'package.json' ],
        dependencies: {} }
    ]);
  },

  'it should be OK to define the main file as just a directory': function() {
    var tree = cases['package-json-guess-directory'];
    // set up fakeFS
    this.fakeFS = tree.fakeFS;
    infer(tree);
    console.log(util.inspect(tree, null, 10, true));
    assert.equal(tree.packages.length, 2);
    assert.deepEqual(tree.packages, [
      { files: [ '/a/index.js' ], dependencies: { b: 1 } },
      { name: 'b',
        basepath: '/a/node_modules/b/',
        mainfile: 'lib/index.js',
        files: [ 'package.json', 'lib/index.js' ],
        dependencies: {} }
    ]);
  },

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
