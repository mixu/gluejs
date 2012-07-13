var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('../lib/glue.js');

exports['glue'] = {

  beforeEach: function(done) {
    this.g = new Glue()
          .basepath('./fixtures/')
          .export('module.exports');
    done();
  },

  'can render a single file and require the result': function (done) {
    var g = this.g;
    this.g.include('./fixtures/lib/simple.js')
      .main('./lib/simple.js')
      .render(function(err, text) {
        require('fs').writeFileSync(__dirname + '/tmp/out1.js', text);
        assert.deepEqual(require('./tmp/out1.js'), { simple: true});
        done();
      });
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

  'concat calls render() on arguments and returns the full result': function(done) {
    var assertions = 0;
    this.g.concat([
        { render: function(done) { assertions++; done(undefined, 'a'); } },
        { render: function(done) { assertions++; done(undefined, 'b'); } },
      ], function(err, txt) {
        assert.equal(txt, 'ab');
        assert.equal(assertions, 2);
        done();
    });
  },

  'can define custom handlers': function(done) {
    var g = this.g,
        extensionRe = new RegExp('(.+)\.handlebars$');
    g.include('./fixtures/mixed_content/')
      .handler(extensionRe, function(opts, done) {
        var filename = opts.filename;
        var template = fs.readFileSync(filename).toString();
        done(g.wrap(filename.replace(extensionRe, '$1.js'), template));
      })
      .render(function(err, txt) {
        console.log(txt);
        done();
      });
  }


/*
  'can include a package.json file': function(done) {
    this.g.npm('./fixtures/package.json');

  },
*/

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
