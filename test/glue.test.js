var path = require('path'),
    assert = require('assert'),
    Glue = require('../lib/renderer.js');

exports['glue'] = {

  beforeEach: function(done) {
    this.g = new Glue()
          .basepath('./fixtures/')
          .export('module.exports');
    done();
  },

  'can include a single file': function (done) {
    var g = this.g;
    this.g.include('./fixtures/lib/simple.js')
      .main('./lib/simple.js')
      .render(function(err, text) {
        assert.equal(g.paths[0], __dirname + '/fixtures/lib/simple.js');
        require('fs').writeFileSync(__dirname + '/tmp/out1.js', text);
        assert.deepEqual(require('./tmp/out1.js'), { simple: true});
        done();
      });
  },

  'can include a directory': function(done) {
    this.g.include('./fixtures/lib/');
    assert.equal(this.g.paths.length, 3);
    assert.ok(this.g.paths.some(function(v) { return v == __dirname + '/fixtures/lib/simple.js' }));
    assert.ok(this.g.paths.some(function(v) { return v == __dirname + '/fixtures/lib/has_dependency.js' }));
    done();
  },

  'can exclude a path by regexp': function(done) {
    this.g.exclude('module');
    assert.equal(this.g.excluded[0], 'module');
    done();
  },

  'can replace a module by name': function(done) {
    var g = this.g;
    this.g.include('./fixtures/lib/has_dependency.js')
      .main('./lib/has_dependency.js')
      .replace('dependency', '1234')
      .render(function(err, text) {
        assert.ok(g.replaced.dependency);
        assert.equal('1234', g.replaced.dependency);
        require('fs').writeFileSync(__dirname + '/tmp/out2.js', text);
        assert.deepEqual({ has_dependency: true, dependency: 1234 }, require('./tmp/out2.js'));
        done();
      });
  },

/*
  'can include a package.json file': function(done) {
    this.g.npm('./fixtures/package.json');

  },
*/

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
