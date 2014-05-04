var assert = require('assert'),
    util = require('util');

var infer = require('../../../lib/list-tasks/infer-packages.js'),
    FixtureGen = require('../../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    runTasks = require('../../../lib/runner/transforms/index.js');

var cache = Cache.instance({
    method: 'stat',
    path: require('os').tmpDir() + '/gluejs-' + new Date().getTime()
});

var fixtureGen = new FixtureGen();

function fixtureDir(spec, onDone) {
  // set up fixture
  var outDir = fixtureGen.dir(spec);

  runTasks({
    include: outDir,
    cache: cache,
    jobs: 1
  }, function(err, results) {
    if (err) {
      throw err;
    }
    onDone(outDir, results);
  })
}

function assertHasFilenames(actual, expected) {
  expected.forEach(function(filepath) {
    assert.ok(actual.some(function(obj) {
      return obj.filename === filepath
    }), 'a file named ' + filepath + ' should exist in the output '+ JSON.stringify(actual));
  });
}

function assertPartialDeepEqual(actual, expected) {
  Object.keys(expected).forEach(function(key) {
    assert.deepEqual(actual[key], expected[key]);
  });
}

exports['infer-packages'] = {

  'can infer a single-file package': function(done) {
    fixtureDir({
      'simple.js': 'module.exports = true;'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 1);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof packages[0].name == 'undefined');
      assert.equal(packages[0].basepath, outDir);
      assert.equal(packages[0].main, 'simple.js');
      // the package files should be correct
      assertHasFilenames(packages[0].files, [ outDir + '/simple.js']);
      done();
    });
  },

  'can infer two packages from module-file and detect the right main file': function(done) {
    fixtureDir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo.js': 'module.exports = true;'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof packages[0].name == 'undefined');
      // the package files should be correct
      assertHasFilenames(packages[0].files, [ outDir + '/index.js']);
//      assert.deepEqual(packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(packages[1].name, 'foo');
      assert.equal(packages[1].basepath, outDir + '/node_modules/');
      assert.equal(packages[1].main, 'foo.js');
      assertHasFilenames(packages[1].files, [ outDir + '/node_modules/foo.js' ]);
//      assert.deepEqual(packages[1].dependenciesById, { });
      done();
    });
  },

  'can infer two packages from module-folder': function(done) {
    fixtureDir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/index.js': 'module.exports = require("./lib/sub");',
      'node_modules/foo/lib/sub.js': 'module.exports = true;'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof packages[0].name == 'undefined');
      // the package files should be correct
      assertHasFilenames(packages[0].files, [ outDir + '/index.js']);
//      assert.deepEqual(packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(packages[1].name, 'foo');
      assert.equal(packages[1].basepath, outDir + '/node_modules/foo/');
      assert.equal(packages[1].main, 'index.js');
      assertHasFilenames(packages[1].files, [
        outDir + '/node_modules/foo/index.js',
        outDir + '/node_modules/foo/lib/sub.js'
      ]);
//      assert.deepEqual(packages[1].dependenciesById, { });
      done();
    });
  },

  'can pick up main file name from package.json': function(done) {
    fixtureDir({
      'index.js': 'module.exports = require("foo");',
      'node_modules/foo/main.js': 'module.exports = require("./lib/sub");',
      'node_modules/foo/lib/sub.js': 'module.exports = true;',
      'node_modules/foo/package.json': '{ "main": "main.js" }'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof packages[0].name == 'undefined');
      // the package files should be correct
      assertHasFilenames(packages[0].files, [ outDir + '/index.js']);
//      assert.deepEqual(packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(packages[1].name, 'foo');
      assert.equal(packages[1].basepath, outDir + '/node_modules/foo/');
      assert.equal(packages[1].main, 'main.js');
      assertHasFilenames(packages[1].files, [
        outDir + '/node_modules/foo/main.js',
        outDir + '/node_modules/foo/lib/sub.js' ]);
//      assert.deepEqual(packages[1].dependenciesById, { });
      done();
    });
  },

  'can pick up recursive node_modules': function(done){
    fixtureDir({
      'index.js': 'module.exports = require("aa");',
      'node_modules/aa/index.js': 'module.exports = require("bb");',
      'node_modules/aa/node_modules/bb.js': 'module.exports = require("cc");',
      'node_modules/aa/node_modules/cc/differentfile.js': 'module.exports = true;',
      'node_modules/aa/node_modules/cc/package.json': '{ "main": "differentfile.js" }'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));

      assert.equal(packages.length, 4);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir,
        main: 'index.js',
//        dependenciesById: { aa: 1 }
      });
      assertHasFilenames(packages[0].files, [ outDir + '/index.js' ]);

      assertPartialDeepEqual(packages[1], {
        name: 'aa',
        uid: 1,
        basepath: outDir + '/node_modules/aa/',
        main: 'index.js',
//        dependenciesById: { bb: 2, cc: 3 }
      });
      assertHasFilenames(packages[1].files, [ outDir + '/node_modules/aa/index.js' ]);

      assertPartialDeepEqual(packages[2],{
        name: 'bb',
        uid: 2,
        basepath: outDir + '/node_modules/aa/node_modules/',
        main: 'bb.js',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[2].files,
        [ outDir + '/node_modules/aa/node_modules/bb.js' ]);

      assertPartialDeepEqual(packages[3], {
        name: 'cc',
        uid: 3,
        basepath: outDir + '/node_modules/aa/node_modules/cc/',
        main: 'differentfile.js',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[3].files, [
        outDir + '/node_modules/aa/node_modules/cc/differentfile.js'
      ]);
      done();
    });
  },

/*
  // looks like a detective bug
  'can resolve single .json file npm module': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = require("b");',
      'a/node_modules/b.json': '{}'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir,
        main: 'a/index.js',
//        dependenciesById: { b: 1 }
      });
      assertHasFilenames(packages[0].files, [ outDir + '/a/index.js']);
      assertPartialDeepEqual(packages[1], {
        name: 'b',
        uid: 1,
        basepath: outDir + '/a/node_modules/',
        main: 'b.json',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[1].files, [ outDir + '/a/node_modules/b.json' ]);

      done();
    });
  },
*/

  'it should be OK to define the main file without the .js extension': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = require("b");',
      'a/node_modules/b/alt.js': 'module.exports = true;',
      'a/node_modules/b/package.json': '{ "main": "alt" }',
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir,
        main: 'a/index.js',
//        dependenciesById: { b: 1 }
      });
      assertHasFilenames(packages[0].files, [ outDir + '/a/index.js']);
      assertPartialDeepEqual(packages[1],{ name: 'b',
        uid: 1,
        basepath: outDir + '/a/node_modules/b/',
        main: 'alt.js',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[1].files,
        [ outDir + '/a/node_modules/b/alt.js' ]);
      done();
    });
  },

  'it should be OK to define the main file as just a directory': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = require("b");',
      'a/node_modules/b/lib/index.js': 'module.exports = true;',
      'a/node_modules/b/package.json': '{ "main" : "./lib" }'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir,
        main: 'a/index.js',
//        dependenciesById: { b: 1 }
      });
      assertHasFilenames(packages[0].files, [ outDir + '/a/index.js']);
      assertPartialDeepEqual(packages[1], {
        name: 'b',
        uid: 1,
        basepath: outDir + '/a/node_modules/b/',
        main: 'lib/index.js',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[1].files,
        [ outDir + '/a/node_modules/b/lib/index.js' ]);
      done();
    });
  },

  'if the main path is a relative path, it should be normalized': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = require("b");',
      'a/node_modules/b/url.js': 'module.exports = true;',
      'a/node_modules/b/package.json': ' { "main": "./foo/../url.js" }'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir,
        main: 'a/index.js',
//        dependenciesById: { b: 1 }
      });
      assertHasFilenames(packages[0].files, [ outDir + '/a/index.js']);
      assertPartialDeepEqual(packages[1], {
        name: 'b',
        uid: 1,
        basepath: outDir + '/a/node_modules/b/',
        main: 'url.js',
//        dependenciesById: {}
      });
      assertHasFilenames(packages[1].files,
        [ outDir + '/a/node_modules/b/url.js' ]);
      done();
    });
  },

  'for each dependency in package.json, add a dependency entry even if the file is not in the list': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = require("b");',
      'a/package.json': JSON.stringify({
        main: 'index.js',
        dependencies: {
          b: '*',
          d: '1.x' // this dep only exists in the package.json file
        }
      }),
      'a/node_modules/b/url.js': 'module.exports = true;',
      'a/node_modules/b/package.json': JSON.stringify({
        main: 'url.js',
        dependencies: {
          c: '*'
        }
      }),
      // 'a/node_modules/c.js': 'module.exports = true;'
    }, function(outDir, files) {
      var packages = infer(files, { basepath: outDir + '/a/' });
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(packages.length, 2);

      assertPartialDeepEqual(packages[0], {
        basepath: outDir + '/a/',
        main: 'index.js',
//        dependenciesById: { b: 1, d: null }
      });
      assertHasFilenames(packages[0].files,
        [ outDir + '/a/index.js',
          outDir + '/a/package.json' ]);
      assertPartialDeepEqual(packages[1], {
        name: 'b',
        uid: 1,
        basepath: outDir + '/a/node_modules/b/',
        main: 'url.js',
//        dependenciesById: { c: null }
      });
      assertHasFilenames(packages[1].files,
        [ outDir + '/a/node_modules/b/url.js' ]);
      done();
    });
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
