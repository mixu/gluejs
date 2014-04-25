var Transform = require('readable-stream').Transform;

function WrapCJS(options) {
  Transform.call(this, options);
  this.opts = options || {};
  this.length = 0;
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  this.length += chunk.length;
  done(null, chunk);
};

WrapCJS.prototype._flush = function(done) {
  if (this.opts.onDone) {
    this.opts.onDone(this.length);
  }
  done();
};

module.exports = function(options) {
  var instance = new WrapCJS(options);
  return {
    stdin: instance,
    stdout: instance
  };
};
