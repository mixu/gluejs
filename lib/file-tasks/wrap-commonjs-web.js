var Transform = require('readable-stream').Transform;

function WrapCJS(options) {
  Transform.call(this, options);
  this.first = true;
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  if(this.first) {
    this.push('function(module, exports, require){\n');
    this.first = false;
  }
  this.push(chunk);
  done();
};

WrapCJS.prototype._flush = function(done) {
  this.push('}');
  done();
};

module.exports = function() {
  var instance = new WrapCJS();
  return {
    stdin: instance,
    stdout: instance
  };
};
