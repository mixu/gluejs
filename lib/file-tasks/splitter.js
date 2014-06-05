var fs = require('fs'),
    PassThrough = require('readable-stream').PassThrough,
    runOnce = require('../util/run-once.js');

module.exports = function(cacheFile, dest, onDone) {
  // create a file that caches the result
  var splitter = new PassThrough(),
      cacheOut = fs.createWriteStream(cacheFile);

  // order matters here, prefer writing the cached output before the destination
  // so that requests made in rapid succession still hit the cache
  splitter.pipe(cacheOut);
  splitter.pipe(dest);

  var onCacheEnd = runOnce(function() {
    onDone(null, cacheFile);
  });

  cacheOut.once('finish', onCacheEnd).once('close', onCacheEnd);

  return splitter;
};
