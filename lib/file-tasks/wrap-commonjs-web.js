var EventEmitter = require('events').EventEmitter,
    Stream = require('stream');

module.exports = function() {
  var first = true;
  var r = new EventEmitter();
  r.readable = true;
  r.setEncoding = r.pause = r.resume = r.destroy = function() {};
  r.pipe = Stream.prototype.pipe;

  var w = new EventEmitter();
  w.writable = true;
  w.destroy = w.destroySoon = function() {};
  w.write = function(data) {
    console.log('write', data);
    if(first) {
      r.emit('data', 'function(module, exports, require){\n');
      first = false;
    }
    r.emit('data', data);
  };
  w.pipe = Stream.prototype.pipe;
  w.end = function(str) {
    console.log('end', str);
    r.readable = false;
    r.emit('data', '}');
    if(str) {
      r.emit('end', str);
    } else {
      r.emit('end');
    }
    w.emit('close');
  };

  return {
    stdin: w,
    stdout: r
  };
};
