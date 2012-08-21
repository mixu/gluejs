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
    this.g.include('./fixtures/rendertest/simple.js')
      .main('./rendertest/simple.js')
      .render(function(err, text) {
        require('fs').writeFileSync(__dirname + '/tmp/out1.js', text);
        assert.deepEqual(require('./tmp/out1.js'), { simple: true});
        done();
      });
  },

  'can replace a module by name': function(done) {
    var g = this.g;
    this.g.include('./fixtures/rendertest/has_dependency.js')
      .main('./rendertest/has_dependency.js')
      .replace('dependency', '1234')
      ._render(function(out) { console.log(out); })
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
        done(filename.replace(extensionRe, '$1.js'), template);
      })
      .render(function(err, txt) {
        console.log(txt);
        done();
      });
  },

  'can watch a file': function(done) {
    var g = this.g,
        calls = 0;
    g.include(__dirname+'/tmp/placeholder.txt')
      .watch(function(err, txt) {
        calls++;
        console.log(txt);
        if(calls == 2) {
          done();
        }
      });
    fs.writeFileSync(__dirname+'/tmp/placeholder.txt', 'This is a placeholder, so that git creates this temp directory.\n\n');
  },

  'can include a single npm package': function(done) {
    this.g
      .basepath('./fixtures/expandsingle/')
      .include(__dirname+'/fixtures/expandsingle/')
      .npm('foo', __dirname+'/fixtures/expandsingle/')
      ._render(function(out) {
        console.log(out);
      })
      .render(function(err, text) {
        require('fs').writeFileSync(__dirname + '/tmp/out3.js', text);
        assert.deepEqual(require('./tmp/out3.js'), 'foo.js');
        done();
      });
  },

  'can include a package.json': function(done) {
    this.g
      .basepath('./fixtures/includepackage/')
      .include(__dirname+'/fixtures/includepackage/')
      .npm(__dirname+'/fixtures/includepackage/package.json')
      ._render(function(out) {
        console.log(out);
      })
      .render(function(err, text) {
        require('fs').writeFileSync(__dirname + '/tmp/out4.js', text);
        assert.deepEqual(require('./tmp/out4.js'),  {"aaa":{"aaa":"aaa","ccc":"ccc"},"bbb":"bbb"});
        done();
      });
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
