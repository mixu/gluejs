// use readable-stream to use Node 0.10.x streams in Node 0.8.x
var Writable = require('readable-stream').Writable,
    util = require('util');

function Wrap(options) {
  Writable.call(this, options);
  this.buffer = '';
}

util.inherits(Wrap, Writable);

Wrap.prototype._write = function(chunk, encoding, done) {
  // marked cannot stream input, so we need to accumulate it here.
  this.buffer += chunk;
  done();
};

Wrap.prototype.get = function() {
 return this.buffer;
};

module.exports = Wrap;
