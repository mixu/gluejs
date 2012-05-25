var fs = require('fs'),
    path = require('path');

var requireCode = fs.readFileSync(__dirname + '/require.js', 'utf8')
  .replace(/\/*([^/]+)\/\n/g, '')
//  .replace(/\n/g, '')
//  .replace(/ +/g, ' ');

var defaults = {
  main: 'index.js',
  reqpath: path.dirname(require.cache[__filename].parent.filename)
};

function Renderer(options) {
  this.options = options || { };
  defaults.basepath = defaults.reqpath;
  Object.keys(defaults).forEach(function(key) {
    Renderer.prototype[key] && this[key](defaults[key]);
  }, this);
  this.paths = [];
  this.excluded = [];
  this.replaced = {};
};

Renderer.prototype.set = function(key, val){
  this.options[key] = val;
  return this;
};

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

Renderer.prototype.exclude = function(module) {
  this.excluded.push(module);
  return this;
};

Renderer.prototype.replace = function(module, code) {
  if(arguments.length == 1 && Object.isObject(module)) {
    Object.keys(module).forEach(function(k) {
      this.replace(k, module[v]);
    }, this);
  } else {
    this.excluded.push(module);
    if(typeof code == 'object') {
      this.replaced[module] = JSON.stringify(code);
    } else {
      // function / number / boolean / undefined all convert to string already
      this.replaced[module] = code;
    }
  }
  return this;
};

Renderer.prototype.include = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
    if(p.substr(0, 2) == './') {
      p = path.normalize(self.options.reqpath + '/' + p);
    }
    var isDirectory = fs.statSync(p).isDirectory();

    if (isDirectory) {
      return fs.readdirSync(p).forEach(function (f) {
        self.include((p[p.length - 1] == '/' ? p : p + '/') + f);
      });
    }
    self.paths.push(p);
  });
  return this;
};

// Exclude paths based on expressions (done just before rendering)
Renderer.prototype._exclude = function() {
  var self = this;
  this.excluded.forEach(function(expr) {
    self.paths = self.paths.filter(function(p){
      if(expr.test && expr.test(p)) {
        return false;
      } else if(p.substr(expr.length) == expr) {
        return false;
      }
      return true;
    })
  });
};

Renderer.prototype.render = function(done){
  if(!done) return this;
  if(this.options.basepath.substr(0, 2) == './') {
    this.options.basepath = path.normalize(this.options.reqpath + '/' + this.options.basepath);
  }
  if(this.options.basepath[this.options.basepath.length -1 ] !== '/') {
    this.options.basepath += '/';
  }
  this._exclude();
  var self = this,
      opt = this.options,
      relpath = this.relpath(opt.main.replace(/^\.\//, ''));

  var data = '(function(){'
    + 'var global = this;'
    + requireCode
    + '\n'
    + Object.keys(this.replaced).reduce(function(str, key) {
      var value = self.replaced[key];
      return str + 'require.modules["' + key + '"] = { exports: ' + value + ' };\n';
    }, '')
    + this.paths.reduce(function(str, path) {
      return str + self._render(path);
    }, '')
    + (opt.export || opt.main) + ' = require(\'' +  relpath + '\');\n'
    + '})();';

  done(undefined, data);
  return this;
};

Renderer.prototype._render = function(filepath) {
  var source = fs.readFileSync(filepath, 'utf8'),
      relpath = this.relpath(filepath);

  return 'require.modules[\'' + relpath + '\'] = '
    + 'function(module, exports, require, global){\n' + source + '\n};';
};

Renderer.prototype.relpath = function(filepath) {
  var base = this.options.basepath;

  if (base == filepath.substr(0, base.length)) {
    filepath = filepath.substr(base.length);
  }
  return filepath;
};

module.exports = Renderer;
