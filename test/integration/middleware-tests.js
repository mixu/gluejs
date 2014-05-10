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
      'syntax/err.js': 'require("./index") }syntax error[',
      'etag/index.js': 'module.exports = "etag";'
    });
    // initialize routes
    var app = express();

    app.use(function(req, res, next){
      console.log('%s %s', req.method, req.url);
      next();
    });

    this.outDir = outDir;
    this.app = app;
    this.server = app.listen(3000, done);
  },

  after: function(done) {
    this.server.close(done);
  },

  'can specify a middleware build with a single file target': function(done) {
    // first: single main file + all deps
    this.app.use('/js/first.js',
      Glue.middleware(this.outDir + '/first/index.js', { umd: true })
    );

    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/first.js',
      function(err, res, body) {
        assert.equal(res.statusCode, 200);
        fs.writeFileSync(outFile, body);
        var result = require(outFile);
        // console.log(body);
        assert.deepEqual(result, "Dep");
        done();
      });
  },
/*
  'can specify a build with two external modules as targets': function(done) {

    // second: two external dependencies
    this.app.use('/js/second.js', Glue.middleware([ 'dep', 'dep2' ], {
      umd: true,
      basepath: this.outDir + '/first',
      'global-require': true
    }));

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
    // third: full invocation
    this.app.use('/js/third.js', Glue.middleware({
      umd: true,
      basepath: this.outDir + '/third',
      include: [ './lib/index.js', './foo/bar.js' ],
      main: 'lib/index.js'
    }));

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
    // syntax error
    this.app.use('/js/syntax.js',
      Glue.middleware(this.outDir + '/syntax/index.js', { umd: true })
    );

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
  },


  'production mode': function() {
/*
    app.use('/js/third.js', Glue.middleware({
      umd: true,
      basepath: outDir + '/third',
      include: [ './lib/index.js', './foo/bar.js' ],
      main: 'lib/index.js'

      staticFolder: (DEBUG_MODE ? false : __dirname + '/precompiled/' )
    }));
*/
  },

  'can avoid expensive operations using an etag': function(done) {
    this.app.use('/js/etag.js', Glue.middleware({
      include: this.outDir + '/etag/index.js',
      canSkipBuild: true,
      umd: true,
      debug: true
    }));

    // generate build
    request.get('http://localhost:3000/js/etag.js', function(err, res, body) {
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers.etag);
      var etag = res.headers.etag;
      // insert some delay to allow the cache write operation to complete,
      // since the request will otherwise go out before the end operation
      setTimeout(function() {
        // ask for the same build again, sending the necessary headers
        request.get({
          url: 'http://localhost:3000/js/etag.js',
          headers: {
            'if-none-match': etag
          }
        },
          function(err, res, body) {
            // the full build should be returned from cache
            assert.equal(res.statusCode, 304);
            assert.ok(res.headers.etag);
            assert.equal(body.length, 0);
            assert.equal(etag, res.headers.etag);
            done();
        });
      }, 10);
    });
  },

  // TODO
  'can prerender the build using a watcher like chokidar': function() {
    var chokidar = require('chokidar');

    var isDirty = true;

    var opts = {
      include: this.outDir + '/watcher/',
      umd: true,
      canSkipBuild: function() {
        return isDirty;
      },
      on: {
        done: function() {
          isDirty = false;
        }
      }
    };

    var watcher = chokidar.watch('file or dir', {ignored: /[\/\\]\./, persistent: true});

    watcher
      .on('all', function(event, path) {
        console.log('watcher:', event, path);
        // mark the build as dirty
        isDirty = true;

        // preheat the cache by triggering a new preRender
        new Glue(opts).preRender(function() {
          isDirty = false;
        });
      });

    this.app.use('/js/watcher.js', Glue.middleware(opts));
  },

  'switching between development and production mode': function(done) {
    var staticFile = this.fixture.filename({ ext: '.js' });
    var opts = {
      basepath: this.outDir,
      include: './first/index.js',
      umd: true
    };

    var buildCount = 0;

    this.app.get('/js/production-mode.js', function(req, res, next) {
      if (false) {
        return next();
      }
      res.sendfile(staticFile, function(err) {
        if(!err) {
          return; // completed successfully
        }
        if (err.code && err.code === 'ENOENT') {
          opts.out = fs.createWriteStream(staticFile);
          buildCount++;
          return next(); // run gluejs
        }
        return next(err);
      });
    }, Glue.middleware(opts));

    var outFile = this.fixture.filename({ ext: '.js' });
    request.get('http://localhost:3000/js/production-mode.js',
      function(err, res, body) {
        assert.equal(res.statusCode, 200);
        fs.writeFileSync(outFile, body);
        var result = require(outFile);
        assert.deepEqual(result, "Dep");
        assert.equal(buildCount, 1);
        request.get('http://localhost:3000/js/production-mode.js',
          function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert.equal(buildCount, 1);
            done();
        });
      });
  }
};

