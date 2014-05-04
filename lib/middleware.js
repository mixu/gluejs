var log = require('minilog')('api');

function supportsGzip(req) {
  return req.headers
      && req.headers['accept-encoding']
      && req.headers['accept-encoding'].indexOf('gzip') !== -1;
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

  // TEMP FIX
  if(opts.remap) {
    glue.remap(opts.remap);
  }


  var zcache = [];

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
      var etag = req.headers['if-none-match'],
          canSkipBuild = (typeof opts['canSkipBuild'] === 'function' ?
            opts['canSkipBuild']() : opts['canSkipBuild']);
      if (glue.hasETag(etag)) {
        res.statusCode = 304;
        res.setHeader('etag', etag);
        return res.end();
      }
    }

    // 0.8.x does not have the res.headersSent property
    var headersSent = false;
    res.once('close', function() {
      headersSent = true;
    }).once('finish', function() {
      headersSent = true;
    });

    if(Buffer.isBuffer(zcache)) {
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(zcache);
    }

    // gzip
    var gzip;
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


    // -- Render file and pipe to response
    glue
      .on('etag', function(etag) {
        if (!headersSent) {
          res.setHeader('ETag', etag);
          console.log('SET etaga', etag);
        } else {
          console.log('etag fail', etag);
        }
      })
      .on('error', function(err) {
        var strErr = err.toString(),
            reqUrl = (req.originalUrl ? req.originalUrl : req.url);
        if (err.path || err.fileName) {
          strErr = '[' + (err.path || err.fileName) +
            ':' + err.lineNumber +
            ':' + err.column + '] '
            + err.message;
        }

        log.error('gluejs middleware: ' + reqUrl + ' returning 500 due to error: ', err);
        res.statusCode = 500;
        res.write('console.error("[500] gluejs build error (at: ' +
          req.protocol + '://' + req.host + reqUrl + '):\\n      ", ' +
          JSON.stringify(strErr) + ');\n');
        res.end();
      })
      .render(gzip ? gzip : res);
  };
};
