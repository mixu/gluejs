var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('../lib/index.js');

exports['glue'] = {

  beforeEach: function() {
    this.g = new Glue()
          .basepath('./fixtures/')
          .export('module.exports');
  },

  'can set default values for replace': function() {
    Glue.defaults({ replace: { foo: 'bar'} });
    // inspect the render metadata
    this.g._render(function(metadata) {
      assert.deepEqual(metadata.replaced, { foo: 'bar'});
    });
    Glue.defaults({ replace: {} });
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
//      ._render(function(out) { console.log(out); })
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
    Glue.concat([
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
        extensionRe = new RegExp('(.+)\\.handlebars$');
    g.include('./fixtures/mixed_content/')
      // if the handler matches ".handlebars"
      .handler(extensionRe, function(opts, done) {
        var filename = opts.filename;
        // this would, for example, be a compilation of a template
        var template = 'HELLO WORLD';
        done(filename.replace(extensionRe, '$1.js'), template);
      })
      .render(function(err, txt) {
        // check that the task ran
        assert.ok(txt.indexOf('HELLO WORLD') > -1);
        done();
      });
  },

  'can watch a file': function(done) {
    var g = this.g,
        calls = 0;
    g.include(__dirname+'/tmp/placeholder.txt')
      .watch(function(err, txt) {
        calls++;
        // console.log(txt);
        if(calls == 2) {
          // called twice: once when the watch is established, and another time when the writeFileSync runs
          assert.equal(calls, 2);
          done();
        }
      });
    fs.writeFileSync(__dirname+'/tmp/placeholder.txt', 'This is a placeholder, so that git creates this temp directory.\n\n');
  },

  'can include a single npm package': function(done) {
    var asserted = false;
    this.g
      .basepath('./fixtures/expandsingle/')
      .include(__dirname+'/fixtures/expandsingle/')
      .npm('foo', __dirname+'/fixtures/expandsingle/')
      ._render(function(out) {
        // check that there are two package spaces
        assert.equal(out.modules.length, 2);
        // and that the first one contains a reference to foo
        assert.ok(out.modules[0]['foo']);
        asserted = true;
      })
      .render(function(err, text) {
        require('fs').writeFileSync(__dirname + '/tmp/out3.js', text);
        // assert that _render ran
        assert.ok(asserted);
        // assert that requiring the file will return the string inside it
        assert.deepEqual(require('./tmp/out3.js'), 'foo.js');
        done();
      });
  },

  'can include a package.json': function(done) {
    this.g
      .basepath('./fixtures/includepackage/')
      .include(__dirname+'/fixtures/includepackage/')
      .npm(__dirname+'/fixtures/includepackage/package.json')
//      ._render(function(out) {
//        console.log(out);
//      })
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
