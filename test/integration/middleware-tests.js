var assert = require('assert'),
    util = require('util'),
    fs = require('fs');

var Glue = require('gluejs'),
    express = require('express'),
    request = require('request');

module.exports = {
  before: function(done) {
    // create fixtures
    var outDir = this.fixture.dir({
      // one main file with deps
      'first/index.js': 'module.exports = require("dep");',
      'first/node_modules/dep/index.js': 'module.exports = "Dep";',
      'first/node_modules/dep2/index.js': 'module.exports = "Dep2";',
      'third/lib/index.js': 'module.exports = require("../foo/bar");',
      'third/foo/bar.js': 'module.exports = "Bar";',
      'syntax/index.js': 'module.exports = require("./err");',
      'syntax/err.js': 'require("./index") }syntax error['
    });
    // initialize routes
    var app = express();
    // first: single main file + all deps
    app.use('/js/first.js', Glue.middleware(outDir + '/first/index.js', { umd: true}));
    // second: two external dependencies
    app.use('/js/second.js', Glue.middleware([ 'dep', 'dep2' ], {
      umd: true,
      basepath: outDir + '/first',
      'global-require': true
    }));
    // third: full invocation
    app.use('/js/third.js', Glue.middleware({
      umd: true,
      basepath: outDir + '/third',
      include: [ './lib/index.js', './foo/bar.js' ],
      main: 'lib/index.js'
    }));
    // syntax error
    app.use('/js/syntax.js',
      Glue.middleware(outDir + '/syntax/index.js', { umd: true })
    );

    app.use(function(req, res, next){
      console.log('%s %s', req.method, req.url);
      next();
    });

    this.app = app;
    this.server = app.listen(3000, done);
  },

  after: function(done) {
    this.server.close(done);
  },

  'can specify a middleware build with a single file target': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/first.js',
      function(err, res, body) {
        assert.equal(res.statusCode, 200);
        fs.writeFileSync(outFile, body);
        var result = require(outFile);
        console.log(body);
        assert.deepEqual(result, "Dep");
        done();
      });
  },
/*
  'can specify a build with two external modules as targets': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/second.js',
      function(err, res, body) {
        assert.equal(res.statusCode, 200);
        fs.writeFileSync(outFile,
          body +
          '\n\nmodule.exports = require;'
          );
        var result = require(outFile);
        // console.log(fs.readFileSync(outFile).toString());
        assert.deepEqual(result('dep'), "Dep");
        assert.deepEqual(result('dep2'), "Dep2");
        done();
      });
  },
*/
  'can specify a build with full options': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/third.js',
      function(err, res, body) {
        assert.equal(res.statusCode, 200);
        fs.writeFileSync(outFile,
          body);
        var result = require(outFile);
        // console.log(fs.readFileSync(outFile).toString());
        assert.deepEqual(result, "Bar");
        done();
      });
  },

  'when a syntax error occurs, middleware returns errors as expected': function(done) {
    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/syntax.js',
      function(err, res, body) {
        // returns error coce
        assert.equal(res.statusCode, 500);
        // prints to console
        // appends div (not testable)
        fs.writeFileSync(outFile, body);
        require(outFile);
        // console.log(fs.readFileSync(outFile).toString());
        done();
      });
  }
};

