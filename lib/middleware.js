var log = require('minilog')('api');

function supportsGzip(req) {
  return req.headers &&
         req.headers['accept-encoding'] &&
         req.headers['accept-encoding'].indexOf('gzip') !== -1;
}

// Attached onto the API class, so `this` is the instance

module.exports = function(opts) {
  var API = require('../index.js');

  // allow .middleware(str|arr, opts)
  if (arguments.length === 2) {
    var args = Array.prototype.slice.call(arguments);
    opts = args[1];
    opts.include = args[0];
  } else if (typeof opts === 'string' || Array.isArray(opts)) {
    opts = { include: opts };
  }
  // -- Set some sane defaults
  opts = opts || {};
  opts.include = opts.include || './lib';

  // -- Create an instance of the API to use
  var glue = new API();

  // -- All other options are set by clobbering the glue.options hash
  Object.keys(opts).forEach(function(key) {
    glue.set(key, opts[key]);
  });

  // var zcache = [];

  // -- Middleware to return
  return function(req, res, next) {

    // -- Return all non GET requests
    if ('GET' !== req.method) return next();

    // -- Set content-type
    res.setHeader('Content-Type', 'application/javascript');

    // -- Set etag if the request has one
    if (req.headers['if-none-match']) {
      // allow the build to be skipped if:
      // 1) does a build with this etag exist? `etag` option
      // 2) you be certain that the input files and directories are
      // all in the same state (e.g. due to a watcher)? `canSkipBuild` option

      // set the etag
      glue.set('etag', req.headers['if-none-match']);
      // set the clean flag
      var isClean = (typeof opts.isClean === 'function' ? opts.isClean() : opts.isClean);
      glue.set('clean', isClean);
    } else {
      glue.set('etag', undefined);
      glue.set('clean', false);
    }

    // 0.8.x does not have the res.headersSent property
    var headersSent = false;
    res.once('close', function() {
      headersSent = true;
    }).once('finish', function() {
      headersSent = true;
    });

    /*
    if(Buffer.isBuffer(zcache)) {
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(zcache);
    }
    */

    // gzip
    var gzip;
    /*
    if(supportsGzip(req)) {
      res.setHeader('Content-Encoding', 'gzip');
      gzip = require('zlib').createGzip();
      gzip.pipe(res);
      gzip.on('data', function(chunk) {
        zcache.push(chunk);
      }).once('close', function() {
        zcache = Buffer.concat(zcache);
      }).once('finish', function() {
        zcache = Buffer.concat(zcache);
      });
    }
    */


    // -- Render file and pipe to response
    // Note that the base instance here is being reused, so event listeners need to be
    // cleaned up between requests.
    glue
      .once('etag', function(etag) {
        if (!headersSent) {
          res.setHeader('ETag', etag);
          if (req.headers['if-none-match'] && req.headers['if-none-match'] == etag) {
            // if the new etag == old etag then send a 304 response
            res.statusCode = 304;
          }
        }
      })
      .once('error', function(err) {
        var strErr = err.toString(),
            reqUrl = (req.originalUrl ? req.originalUrl : req.url);

        // some internal functions return an object with err.err(!)
        if (err && err.err instanceof Error) {
          strErr = err.err.toString();
        }

        // avoid bad toString conversion
        if (strErr === '[object Object]') {
          strErr = JSON.stringify(err);
        }

        if (err.path || err.fileName) {
          strErr = '[' + (err.path || err.fileName) +
            ':' + err.lineNumber +
            ':' + err.column + '] ' +
            err.message;
        }

        log.error('gluejs middleware: ' + reqUrl + ' returning 500 due to error: ', err);
        // req.hostname is deprecated
        res.write('console.error("[500] gluejs build error (at: ' +
          req.protocol + '://' + req.hostname + reqUrl + '):\\n      ", ' +
          JSON.stringify(strErr) + ');\n');
        res.end();
      })
      .render(gzip ? gzip : res);
  };
};
