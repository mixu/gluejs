var fs = require('fs'),
    path = require('path'),
    Group = require('./group');

var requireCode = fs.readFileSync(__dirname + '/require.js', 'utf8')
  .replace(/\/*([^/]+)\/\n/g, '')
  .replace(/\n/g, '')
  .replace(/ +/g, ' ');

var defaults = {
  main: 'index.js',
  reqpath: path.dirname(require.cache[__filename].parent.filename)
};

function Renderer(options) {
  var self = this;
  options || (options = { });
  options.basepath = options.reqpath = defaults.reqpath;
  options.main = defaults.main;
  this.options = options;
  this.files = new Group();
  // take all the .js files and concatenate them
  this.handler(new RegExp('.*\.js$'), function(filepath, cb) {
    return cb(self.wrap(filepath, fs.readFileSync(filepath, 'utf8')));
  });
  this.replaced = {};
  this.code = {};
};

Renderer.prototype.set = function(key, val){
  this.options[key] = val;
  return this;
};

// redirect include / exclude / watch to the group
Renderer.prototype.include = function(f) { this.files.include(this._fullPath(f)); return this; };
Renderer.prototype.exclude = function(f) { this.files.exclude(f); return this; };
Renderer.prototype.handler = function(re, fn) { this.files.handler(re, fn); return this; };

// convinience methods for set(key, value)
['export', 'main', 'basepath', 'reqpath'].forEach(function(key) {
  Renderer.prototype[key] = function(value) {
    return this.set(key, value);
  };
});

Renderer.defaults = Renderer.prototype.defaults = function(opts) {
  Object.keys(opts).forEach(function(key) {
    defaults[key] = opts[key];
  });
};

Renderer.prototype.replace = function(module, code) {
  if(arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.replace(k, module[k]);
    }, this);
  } else {
    this.files.exclude(module);
    if(typeof code == 'object') {
      this.replaced[module] = JSON.stringify(code);
    } else {
      // function / number / boolean / undefined all convert to string already
      this.replaced[module] = code;
    }
  }
  return this;
};

Renderer.prototype.define = function(module, code) {
  this.code[module] = code;
  return this;
};

Renderer.prototype.render = function(onDone){
  var self = this;
  this._updateBasePath();
  this.files.exec(function(err, result) { self._renderDone(err, result, onDone); });
};

Renderer.prototype.watch = function(f) {
  var self = this;
  this._updateBasePath();
  this.files.watch(function(err, result) { self._renderDone(err, result, onDone); });
};

Renderer.prototype.wrap = function(moduleName, source) {
  var relpath = moduleName.replace(new RegExp('^'+this.options.basepath), '');
  return 'require.modules[\'' + relpath + '\'] = '
    + 'function(module, exports, require, global){\n' + source + '\n};';
};

Renderer.prototype._renderDone = function(err, result, onDone) {
  var self = this,
      opt = this.options;
  var relpath = opt.main.replace(/^\.\//, '').replace(new RegExp('^'+opt.basepath), '');
  onDone(undefined, '(function(){'
    + 'var global = this;'
    + requireCode
    + '\n'
    // replaced modules
    + Object.keys(self.replaced).reduce(function(str, key) {
      var value = self.replaced[key];
      return str + 'require.modules["' + key + '"] = { exports: ' + value + ' };\n';
    }, '')
    // injected code
    + Object.keys(self.code).reduce(function(str, moduleName) {
      return str + self.wrap(moduleName, self.code[moduleName]);
    }, '')
    // result from the file group
    + result
    // name to export
    + (opt.export || opt.main) + ' = require(\'' +  relpath + '\');\n'
    + '})();');
};

Renderer.prototype._updateBasePath = function() {
  var basepath = this.options.basepath;
  basepath = this._fullPath(basepath);
  basepath += (basepath[basepath.length-1] !== '/' ? '/' : '');
  this.options.basepath = basepath;
}

Renderer.prototype._fullPath = function(p) {
  if(p.substr(0, 2) == './') {
    p = path.normalize(this.options.reqpath + '/' + p);
  }
  return p;
};

Renderer.concat = Renderer.prototype.concat = function(arr, callback) {
  var data = '';
  function run(callable) {
    if (callable) {
      callable.render(function(err, txt) {
        if (err) return callback(err);
        data += txt;
        return run(arr.shift());
      });
    } else {
      return callback(undefined, data);
    }
  }
  return run(arr.shift());
};

module.exports = Renderer;
