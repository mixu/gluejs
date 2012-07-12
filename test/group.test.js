var fs = require('fs'),
    assert = require('assert'),
    Group = require('../lib/group');

exports['given a group'] = {

  beforeEach: function(done) {
    var paths = this.paths = [];
    this.group = new Group().operation(new RegExp('.*'), function(filename, cb) {
      paths.push(filename);
      return cb(filename);
    });
    done();
  },

  'can include a single file': function (done) {
    var g = this.group, paths = this.paths;
    g.include('./fixtures/lib/simple.js')
      .exec(function(result) {
        assert.equal(paths.length, 1);
        assert.equal(paths[0], './fixtures/lib/simple.js');
        done();
      });
  },
  'can include a directory': function(done) {
    var g = this.group, paths = this.paths;
    g.include('./fixtures/lib/')
      .exec(function(result) {
        paths.sort();
        assert.equal(paths.length, 3);
        assert.equal(paths[0], './fixtures/lib/has_dependency.js');
        assert.equal(paths[1], './fixtures/lib/simple.js');
        assert.equal(paths[2], './fixtures/lib/web.js');
        done();
      });
  },

  'can exclude a path by regexp': function(done) {
    var g = this.group, paths = this.paths;
    g.include('./fixtures/lib/')
      .exclude(new RegExp('.*simple\.js$'))
      .exec(function(result) {
        paths.sort();
        assert.equal(paths.length, 2);
        assert.equal(paths[0], './fixtures/lib/has_dependency.js');
        assert.equal(paths[1], './fixtures/lib/web.js');
        done();
      });
  },

  'can watch a file': function(done) {
    var g = this.group, paths = this.paths,
        calls = 0;
    g.include('./tmp/placeholder.txt')
      .watch(function(err, txt) {
        calls++;
        console.log(err, txt);
        if(calls == 2) {
          done();
        }
      });
    fs.writeFileSync('./tmp/placeholder.txt', 'This is a placeholder, so that git creates this temp directory.\n\n');
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
