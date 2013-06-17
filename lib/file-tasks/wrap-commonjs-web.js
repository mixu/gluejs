var Transform = require('readable-stream').Transform;

function WrapCJS(options) {
  Transform.call(this, options);
  this.opts = options || {};
  this.first = true;
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype.writeFirst = function() {
  this.push('function(module, exports, require){\n');
  if(this.opts['source-url']) {
    this.push('eval(');
  }
  this.first = false;
};

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  if(this.first) {
    this.writeFirst();
  }
  if(this.opts['source-url']) {
    this.push(JSON.stringify(chunk.toString())+'+');
  } else {
    this.push(chunk);
  }
  done();
};

WrapCJS.prototype._flush = function(done) {
  // for 0-length files, only _flush is called
  if(this.first) {
    this.writeFirst();
  }
  if(this.opts['source-url']) {
    // Chrome's inspector has a bug which eats some characters
    // (e.g. lib -> ib and example -> xample)
    // https://code.google.com/p/chromium/issues/detail?id=210421
    // Work around that by prepending /
    this.push(JSON.stringify('\n\/\/@ sourceURL= '+
      (this.opts['name'].charAt(0) != '/' ? '/' : '') + this.opts['name'])+');');
  }
  this.push('}');
  done();
};

module.exports = function(options) {
  var instance = new WrapCJS(options);
  return {
    stdin: instance,
    stdout: instance
  };
};
