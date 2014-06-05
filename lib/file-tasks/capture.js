// use readable-stream to use Node 0.10.x streams in Node 0.8.x
var Writable = require('readable-stream').Writable,
    util = require('util'),
    runOnce = require('../util/run-once.js');

function Capture(options) {
  Writable.call(this, options);
  this.buffer = [];
  this.opts = options;
}

util.inherits(Capture, Writable);

Capture.prototype._write = function(chunk, encoding, done) {
  this.buffer.push(chunk);
  done();
};

Capture.prototype.get = function() {
  if (this.opts && this.opts.objectMode) {
    return this.buffer;
  } else {
    return Buffer.concat(this.buffer).toString();
  }
};

Capture.prototype.wrap = function(onDone) {
  // store the function - makes sure dest is always a writable stream
  var onEnd = runOnce(function() {
        onDone(null, capture.get());
      });

  this.once('error', function(err) { onDone(err, null); })
    .once('finish', onEnd)
    .once('close', onEnd);

  return this;
};

module.exports = Capture;
