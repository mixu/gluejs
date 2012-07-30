var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),
    Package = require('../lib/package');

exports['package'] = {

  beforeEach: function(done) {
    this.p = new Package();
    done();
  },
  // exec and watch should actually emit
  // a series of package objects:
  // e.g.
  //  {
  //    './index.js': ... full path to file
  //    'other': { main: 'foo.js', context: 1 }
  //  },
  //  {
  //    './foo.js'
  //  }
  // The first package is the result of calling exec on the current group
  // The next package is the result of calling exec on the first dependency
  // ( and it will recursively call and return its own dependencies)
  // In fact, groups should not even do any handlers.
  // The handlers are a detail that only really matters to the
  // system that outputs the build. Groups should only deal with files.

  'can add a dependency on a single file package': function(done) {
    this.p.dependency('foo', __dirname+'/fixtures/expandsingle/');

    assert.equal(this.p.children.length, 1);
    var child = this.p.children[0];
    assert.equal(child.name, 'foo');
    assert.equal(child.main, '/foo.js');
    assert.equal(child.basepath, __dirname+'/fixtures/expandsingle/node_modules');
    assert.equal(child.files.length, 1);
    assert.equal(child.files[0], __dirname+'/fixtures/expandsingle/node_modules/foo.js');

    var result = [];
    this.p.render(result, function(selfId) {
      // first file group has a reference to the subpackage
      assert.ok(result[0].foo);
      // and the main file is defined
      assert.ok(result[1]['/foo.js']);
      done();
    });
  },

  'can add a dependency on a package that is a directory (index.js)': function(done) {
    this.p.dependency('foo', __dirname+'/fixtures/expandindex/');

    assert.equal(this.p.children.length, 1);
    var child = this.p.children[0];
    assert.equal(child.name, 'foo');
    assert.equal(child.main, '/index.js');
    assert.equal(child.basepath, __dirname+'/fixtures/expandindex/node_modules/foo');
    assert.equal(child.files.length, 3);
    assert.equal(child.files[0], child.basepath+'/index.js');
    assert.equal(child.files[1], child.basepath+'/lib/sub.js');
    assert.equal(child.files[2], child.basepath+'/other.js');

    var result = [];
    this.p.render(result, function(selfId) {
      // first file group has a reference to the subpackage
      assert.ok(result[0].foo);
      // and the files are defined in that context
      assert.ok(result[1]['/index.js']);
      assert.ok(result[1]['/lib/sub.js']);
      assert.ok(result[1]['/other.js']);
      done();
    });
  },


  'can add a dependency on a package that is a directory (package.json)': function(done) {
    var p = this.p;
    p.dependency('foo', __dirname+'/fixtures/expandpackage/');
    // console.log('package', util.inspect(p, null, 5, true));

    assert.equal(p.children.length, 1);
    assert.equal(p.children[0].name, 'foo');
    assert.equal(p.children[0].main, '/lib/sub.js');
    assert.equal(p.children[0].basepath, __dirname+'/fixtures/expandpackage/node_modules/foo');
    assert.equal(p.children[0].files.length, 3);
    assert.equal(p.children[0].files[0], p.children[0].basepath+'/lib/sub.js');
    assert.equal(p.children[0].files[1], p.children[0].basepath+'/other.js');
    assert.equal(p.children[0].files[2], p.children[0].basepath+'/package.json');

    var result = [];
    p.render(result, function(selfId) {
      // console.log('result', util.inspect(result, null, 5, true));
      // first file group has a reference to the subpackage
      assert.ok(result[0].foo);
      // and the files are defined in that context
      assert.ok(result[1]['/lib/sub.js']);
      assert.ok(result[1]['/other.js']);
      done();
    });
  },

  'when a dependency has a (sub)dependency, it gets resolved as well': function(done) {
    var p = this.p;
    p.dependency('foo', __dirname+'/fixtures/hassubdependency/');

    assert.equal(p.children.length, 1);
    assert.equal(p.children[0].name, 'foo');
    assert.equal(p.children[0].main, '/index.js');
    assert.equal(p.children[0].basepath, __dirname+'/fixtures/hassubdependency/node_modules/foo');
    assert.equal(p.children[0].files.length, 2);
    assert.equal(p.children[0].files[0], p.children[0].basepath+'/index.js');
    assert.equal(p.children[0].files[1], p.children[0].basepath+'/package.json');
    // subdependency
    assert.equal(p.children[0].children.length, 1);
    var child = p.children[0].children[0];
    assert.equal(child.name, 'bar');
    assert.equal(child.main, '/index.js');
    assert.equal(child.basepath, __dirname+'/fixtures/hassubdependency/node_modules/foo/node_modules/bar');
    assert.equal(child.files.length, 1);
    assert.equal(child.files[0], child.basepath+'/index.js');

    var result = [];
    p.render(result, function(selfId) {
      // first file group has a reference to the subpackage
      assert.ok(result[0].foo);
      // second group has a subdepency
      assert.ok(result[1].bar);
      // and the files are defined in that context
      assert.ok(result[1]['/index.js']);
      assert.ok(result[2]['/index.js']);
      done();
    });
  },

  'blacklisting a module affects all dependencies': function(done) {
    done();
  },

  'replacing a module affects all dependencies': function(done) {
    done();
  },

  'can include a package.json which causes all dependencies to be included': function(done) {
    done();
  },

  'when including a package.json, node_modules should be searched recursively upwards': function(done) {
    // example:
    // app/agent/package.json => dependencies: { "foo" : ... }
    // app/node_modules/foo <= Node will traverse one directory down since this is not found
    done();
  },

  'can add filters for dependencies to exclude ./test, ./examples, test.js etc': function(done) {
    done();
  }


};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
