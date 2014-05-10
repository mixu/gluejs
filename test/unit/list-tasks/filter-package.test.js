var assert = require('assert'),
    util = require('util');

var infer = require('../../../lib/list-tasks/infer-packages.js'),
    filter = require('../../../lib/list-tasks/filter-packages.js'),
    FixtureGen = require('../../lib/fixture-gen.js'),
    Cache = require('minitask').Cache,
    runTasks = require('../../../lib/runner/transforms/index.js');

var cache = Cache.instance({
    method: 'stat',
    path: require('os').tmpDir() + '/gluejs-' + new Date().getTime()
});

var fixtureGen = new FixtureGen();

function fixtureDir(outDir, include, onDone) {
  // set up fixture
  runTasks({
    include: include,
    cache: cache,
    jobs: 1
  }, function(err, results) {
    if (err) {
      throw err;
    }
    onDone(outDir, results);
  });
}

exports['filter-package'] = {

  'can exclude via package.json whitelist': function(done) {
    var outDir = fixtureGen.dir({
      '/a/excludeme.js': 'module.exports = true;',
      '/a/included_file.js': 'module.exports = true;',
      '/a/included_file.foobar': 'abc',
      '/a/package.json': JSON.stringify({
        files: [
          'included_directory',
          'included_file.js',
          'included_file.foobar'
        ]
      }),
      '/a/excluded_directory/aaa.js': 'module.exports = true;',
      '/a/included_directory/bbb.js': 'module.exports = true;',
      '/a/included_directory/ccc/ddd.js': 'module.exports = true;'
    });
    fixtureDir(outDir, outDir,
      function(outDir, files) {
      // first, infer the package structure
      var packages = infer(files);
      // console.log(util.inspect(packages, null, 10, true));
      assert.equal(files.length, 7);
      // now apply the filter
      packages = filter(packages);
      // console.log(util.inspect(packages, null, 10, true));
      assert.deepEqual(packages[0].files, [
      { filename: outDir + '/a/included_file.js',
         content: outDir + '/a/included_file.js',
         rawDeps: [],
         deps: [],
         renames: [] },
       { filename: outDir + '/a/included_file.foobar',
         content: outDir + '/a/included_file.foobar',
         rawDeps: [],
         deps: [],
         renames: [] },

      // TODO: not sure if /a/included_directory/ccc/ddd.js should be here as well...
       { filename: outDir + '/a/included_directory/bbb.js',
         content: outDir + '/a/included_directory/bbb.js',
         rawDeps: [],
         deps: [],
         renames: [] } ]);
      done();
    });
  },

  'can exclude via .npmignore': function(done) {
    var outDir = fixtureGen.dir({
      '/a/excludeme.js': 'module.exports = true;',
      '/a/foo.excludeme': 'module.exports = true;',
      '/a/included_file.js': 'module.exports = true;',
      '/a/included_file.foobar': 'module.exports = true;',
      // to be honest, the way in which glob matching works in npm is quite nutty
      // https://github.com/isaacs/fstream-ignore/blob/master/ignore.js
      // e.g. trying multiple variants of the same path, recursively against the same rule
      //
      // My goal here is to 1) use the same underlying expression compiler (isaacs/minimatch)
      // and 2) to test that the most common cases are covered.
      '/a/.npmignore': [
        // should strip comments
        '# Comment',
        // specific file
        'excludeme.js',
        // specific extension
        '*.excludeme',
        // specific directory (all four permutations)
        'test',
        '/exclude',
        'docs/',
        '/examples/',
        // glob "dir/*"
        'glob/*',
        // glob "dir/*/**"
        'included_directory/*/**',
        ''
      ],
      '/a/included_directory/bbb.js': 'module.exports = true;',
      '/a/included_directory/excluded_sub/ddd.js': 'module.exports = true;',
      '/a/examples/file': 'module.exports = true;',
      '/a/exclude/file': 'module.exports = true;',
      '/a/test/file': 'module.exports = true;',
      '/a/docs/file': 'module.exports = true;',
      '/a/glob/file': 'module.exports = true;'
    });
    fixtureDir(outDir, outDir, function(outDir, files) {
      // first, infer the package structure
      var packages = infer(files);
      // now apply the filter
      packages = filter(packages);
      // console.log(util.inspect(packages, null, 10, true));
      assert.deepEqual(packages[0].files,  [
       { filename: outDir + '/a/.npmignore',
         content: outDir + '/a/.npmignore',
         rawDeps: [],
         deps: [],
         renames: [] },
       { filename: outDir + '/a/included_file.js',
         content: outDir + '/a/included_file.js',
         rawDeps: [],
         deps: [],
         renames: [] },
       { filename: outDir + '/a/included_file.foobar',
         content: outDir + '/a/included_file.foobar',
         rawDeps: [],
         deps: [],
         renames: [] },
       { filename: outDir + '/a/included_directory/bbb.js',
         content: outDir + '/a/included_directory/bbb.js',
         rawDeps: [],
         deps: [],
         renames: [] } ]);
      done();
    });
  },

/*
  'packages listed in package.json as devDependencies are ignored': function(done) {
    var outDir = fixtureGen.dir({
      '/a/index.js': 'module.exports = true;',
      '/a/node_modules/bar/index.js': 'module.exports = true;',
      '/a/node_modules/bar/package.json': JSON.stringify({
        devDependencies: {
          exclude_me: '*',
          exclude: '*'
        }
      }),
      '/a/node_modules/bar/node_modules/include_me.js': 'module.exports = true;',
      '/a/node_modules/bar/node_modules/exclude_me.js': 'module.exports = true;',
      '/a/node_modules/bar/node_modules/include/second.js': 'module.exports = true;',
      '/a/node_modules/bar/node_modules/exclude/second.js': 'module.exports = true;',
      '/a/node_modules/bar/node_modules/exclude/node_modules/subdependency.js': 'module.exports = true;'
    });
    fixtureDir(outDir, outDir, function(outDir, files) {
      // first, infer the package structure
      var packages = infer(files);
      // now apply the filter
      packages = filter(packages);
      console.log(util.inspect(packages, null, 10, true));
      assert.deepEqual(packages[0].files, [
       { name: '/a/index.js' },
       { name: '/a/node_modules/bar/index.js' },
       { name: '/a/node_modules/bar/package.json' },
       { name: '/a/node_modules/bar/node_modules/include_me.js' },
       { name: '/a/node_modules/bar/node_modules/include/second.js' }
      ]);
      // base package, bar, include and include_me = 4 packages
      assert.equal(packages.length, 4);
      done();
    });
  }
*/
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
