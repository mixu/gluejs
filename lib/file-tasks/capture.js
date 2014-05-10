// use readable-stream to use Node 0.10.x streams in Node 0.8.x
var Writable = require('readable-stream').Writable,
    util = require('util');

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
module.exports = Capture;
