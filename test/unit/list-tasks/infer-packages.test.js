var assert = require('assert'),
    util = require('util');

var infer = require('../../../lib/list-tasks/infer-packages.js'),
    List = require('minitask').list,
    FixtureGen = require('../../lib/fixture-gen.js');

function pluck(key, obj) {
  var o = { };
  o[key] = obj[key];
  return o;
}

var fixtureGen = new FixtureGen();

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function fixtureDir(spec, onDone) {
  // set up fixture
  var outDir = fixtureGen.dir(spec);
  var list = new List();
  list.add(outDir);
  list.exec(function(err, files) {
    files = files.filter(function(item) {
      return item.stat.isFile();
    }).sort(byName);
    onDone(outDir, { files: files });
  });
}

// strip out the .stat items since we don't check the stat values in the assertions
function removeStat(list) {
  list.files = list.files.map(function(item) {
    delete item.stat;
    return item;
  }).sort(byName);

  list.packages = list.packages.map(function(item) {
    delete item.stat;
    item.files = item.files.map(function(sub) {
      delete sub.stat;
      return sub;
    }).sort(byName);
    return item;
  });
  return list;
}

exports['infer-packages'] = {

  'can infer a single-file package': function(done) {
    fixtureDir({
      'simple.js': 'module.exports = true;'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 1);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof list.packages[0].name == 'undefined');
      assert.ok(typeof list.packages[0].basepath == 'undefined');
      assert.ok(typeof list.packages[0].main == 'undefined');
      // the package files should be correct
      assert.deepEqual(list.packages[0].files, [ { name: outDir + '/simple.js' } ]);
      done();
    });
  },

  'can infer two packages from module-file and detect the right main file': function(done) {
    fixtureDir({
      'index.js': 'module.exports = true;',
      'node_modules/foo.js': 'module.exports = true;'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof list.packages[0].name == 'undefined');
      // the package files should be correct
      assert.deepEqual(list.packages[0].files, [ { name: outDir + '/index.js' } ]);
      assert.deepEqual(list.packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(list.packages[1].name, 'foo');
      assert.equal(list.packages[1].basepath, outDir + '/node_modules/');
      assert.equal(list.packages[1].main, 'foo.js');
      assert.deepEqual(list.packages[1].files, [ { name: outDir + '/node_modules/foo.js' } ]);
      assert.deepEqual(list.packages[1].dependenciesById, { });
      done();
    });
  },

  'can infer two packages from module-folder': function(done) {
    var list = {
      files: [
      ].map(function(file) { return { name: file }; }),
      fakeFS: {
        existsSync: function(name) {
          return list.files.some(function(item) {
            return item.name == name;
          });
        },
      }
    };
    fixtureDir({
      'index.js': 'module.exports = true;',
      'node_modules/foo/index.js': 'module.exports = true;',
      'node_modules/foo/lib/sub.js': 'module.exports = true;'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof list.packages[0].name == 'undefined');
      // the package files should be correct
      assert.deepEqual(list.packages[0].files, [ { name: outDir + '/index.js' } ]);
      assert.deepEqual(list.packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(list.packages[1].name, 'foo');
      assert.equal(list.packages[1].basepath, outDir + '/node_modules/foo/');
      assert.equal(list.packages[1].main, 'index.js');
      assert.deepEqual(list.packages[1].files, [
        { name: outDir + '/node_modules/foo/index.js'  },
        { name: outDir + '/node_modules/foo/lib/sub.js' }
        ]);
      assert.deepEqual(list.packages[1].dependenciesById, { });
      done();
    });
  },

  'can pick up main file name from package.json': function(done) {
    fixtureDir({
      'index.js': 'module.exports = true;',
      'node_modules/foo/main.js': 'module.exports = true;',
      'node_modules/foo/lib/sub.js': 'module.exports = true;',
      'node_modules/foo/package.json': '{ "main": "main.js" }'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      // the root (or base) package should be anonymous (=> name is given by the user)
      assert.ok(typeof list.packages[0].name == 'undefined');
      // the package files should be correct
      assert.deepEqual(list.packages[0].files, [ { name: outDir + '/index.js' } ]);
      assert.deepEqual(list.packages[0].dependenciesById, { foo: 1 });

      // foo package
      assert.equal(list.packages[1].name, 'foo');
      assert.equal(list.packages[1].basepath, outDir + '/node_modules/foo/');
      assert.equal(list.packages[1].main, 'main.js');
      assert.deepEqual(list.packages[1].files, [
        { name: outDir + '/node_modules/foo/main.js' },
        { name: outDir + '/node_modules/foo/package.json' } ,
        { name: outDir + '/node_modules/foo/lib/sub.js' } ].sort(byName));
      assert.deepEqual(list.packages[1].dependenciesById, { });
      done();
    });
  },

  'can pick up recursive node_modules': function(done){
    fixtureDir({
      'index.js': 'module.exports = true;',
      'node_modules/aa/index.js': 'module.exports = true;',
      'node_modules/aa/node_modules/bb.js': 'module.exports = true;',
      'node_modules/aa/node_modules/cc/differentfile.js': 'module.exports = true;',
      'node_modules/aa/node_modules/cc/package.json': '{ "main": "differentfile.js" }'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list.packages, null, 10, true));

      assert.equal(list.packages.length, 4);
      assert.deepEqual(list.packages,
        [
        { files: [ { name: outDir + '/index.js' } ],
          dependenciesById: { aa: 1 } },
        { name: 'aa',
          uid: 1,
          basepath: outDir + '/node_modules/aa/',
          main: 'index.js',
          files: [ { name: outDir + '/node_modules/aa/index.js' } ],
          dependenciesById: { bb: 2, cc: 3 } },
        { name: 'bb',
          uid: 2,
          basepath: outDir + '/node_modules/aa/node_modules/',
          main: 'bb.js',
          files: [ { name: outDir + '/node_modules/aa/node_modules/bb.js' } ],
          dependenciesById: {} },
        { name: 'cc',
          uid: 3,
          basepath: outDir + '/node_modules/aa/node_modules/cc/',
          main: 'differentfile.js',
          files:
           [ { name: outDir + '/node_modules/aa/node_modules/cc/differentfile.js' },
             { name: outDir + '/node_modules/aa/node_modules/cc/package.json' } ],
          dependenciesById: {} } ]);
      done();
    });
  },

  'can resolve single .json file npm module': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = true;',
      'a/node_modules/b.json': '{}'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      assert.deepEqual(list.packages,
       [
        { files: [ { name: outDir + '/a/index.js' } ],
         dependenciesById: { b: 1 } },
        { name: 'b',
         uid: 1,
         basepath: outDir + '/a/node_modules/',
         main: 'b.json',
         files: [ { name: outDir + '/a/node_modules/b.json' } ],
         dependenciesById: {} } ]);
      done();
    });
  },

  'it should be OK to define the main file without the .js extension': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = true;',
      'a/node_modules/b/alt.js': 'module.exports = true;',
      'a/node_modules/b/package.json': '{ "main": "alt" }',
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      assert.deepEqual(list.packages, [
       { files: [ { name: outDir + '/a/index.js' } ],
         dependenciesById: { b: 1 } },
       { name: 'b',
         uid: 1,
         basepath: outDir + '/a/node_modules/b/',
         main: 'alt.js',
         files:
          [ { name: outDir + '/a/node_modules/b/alt.js' },
            { name: outDir + '/a/node_modules/b/package.json' } ],
         dependenciesById: {} } ]);
      done();
    });
  },

  'it should be OK to define the main file as just a directory': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = true;',
      'a/node_modules/b/lib/index.js': 'module.exports = true;',
      'a/node_modules/b/package.json': '{ "main" : "./lib" }'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      assert.deepEqual(list.packages,  [ { files: [ { name: outDir + '/a/index.js' } ],
         dependenciesById: { b: 1 } },
       { name: 'b',
         uid: 1,
         basepath: outDir + '/a/node_modules/b/',
         main: 'lib/index.js',
         files:
          [ { name: outDir + '/a/node_modules/b/package.json' },
            { name: outDir + '/a/node_modules/b/lib/index.js' } ].sort(byName),
         dependenciesById: {} } ]);
      done();
    });
  },

  'if the main path is a relative path, it should be normalized': function(done) {
    fixtureDir({
      'a/index.js': 'module.exports = true;',
      'a/node_modules/b/url.js': 'module.exports = true;',
      'a/node_modules/b/package.json': ' { "main": "./foo/../url.js" }'
    }, function(outDir, list) {
      infer(list);
      list = removeStat(list);
      // console.log(util.inspect(list, null, 10, true));
      assert.equal(list.packages.length, 2);
      assert.deepEqual(list.packages,  [ { files: [ { name: outDir + '/a/index.js' } ],
         dependenciesById: { b: 1 } },
       { name: 'b',
         uid: 1,
         basepath: outDir + '/a/node_modules/b/',
         main: 'url.js',
         files:
          [ { name: outDir + '/a/node_modules/b/url.js' },
            { name: outDir + '/a/node_modules/b/package.json' } ].sort(byName),
         dependenciesById: {} } ]);
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
