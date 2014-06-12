// package wrapper
var Transform = require('readable-stream').Transform,
    umd = require('umd');

function WrapCJS(options) {
  Transform.call(this, options);
  this.opts = options || {};
  this.first = true;
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype.writePrelude = function() {
  if (!this.first) {
    return;
  }
  if (this.opts.standalone) {
      return this.push(umd.prelude(this.opts.standalone).trim() + 'return ');
  }
  if (hasExports) {
    return this.push((this.opts.externalRequireName || 'require') + '=');
  }
};

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  if (this.first) {
    this.writePrelude();
  }
  this.first = false;
  this.push(chunk);
  done();
};

WrapCJS.prototype._flush = function(done) {
  if (this.first) {
    this.writePrelude();
  }
  if (this.opts.standalone) {
      this.push(
          '\n(' + JSON.stringify(this.opts.mainModule) + ')' + umd.postlude(this.opts.standalone)
      );
  }

  if (this.opts.debug) {
    this.push('\n');
  }
  done();
};

module.exports = WrapCJS;
