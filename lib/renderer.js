var fs = require('fs'),
    path = require('path');

var requireCode = fs.readFileSync(__dirname + '/require.js', 'utf8')
  .replace(/\/*([^/]+)\/\n/g, '')
//  .replace(/\n/g, '')
//  .replace(/ +/g, ' ');

function Renderer(options) {
  this.options = options || { };
  this.paths = [];
  this.excluded = [];
  this.replaced = {};
};

Renderer.prototype.set = function(key, val){
  this.options[key] = val;
  return this;
};

['export', 'main', 'basepath'].forEach(function(key) {
  Renderer.prototype[key] = function(value) {
    return this.set(key, value);
  };
});

Renderer.prototype.exclude = function(module) {
  this.excluded.push(module);
  return this;
};

Renderer.prototype.replace = function(module, code) {
  this.excluded.push(module);
  this.replaced[module] = code;
  return this;
};

Renderer.prototype.include = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
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

Renderer.prototype.global = function(key, value) {
  if(arguments.length == 1 && Object.isObject(key)) {
    Object.keys(key).forEach(function(k) {
      this.global(k, key[v]);
    }, this);
  } else {
    this.excluded.push(key);
    this.replace[key] = value;
  }
  return this;
};

Renderer.prototype.render = function(done){
  if(!done) return this;
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

  return 'require.modules["' + relpath + '"] = '
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
