var fs = require('fs'),
    path = require('path');

var requireCode = fs.readFileSync(__dirname + '/require.js', 'utf8')
  .replace(/\/*([^/]+)\/\n/g, '')
  .replace(/\n/g, '')
  .replace(/ +/g, ' ');

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
  if(arguments.length == 1 && module === Object(module)) {
    Object.keys(module).forEach(function(k) {
      this.replace(k, module[k]);
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
    p = self._fullPath(p);
    var isDirectory = fs.statSync(p).isDirectory();

    if (isDirectory) {
      p += (p[p.length-1] !== '/' ? '/' : '');
      return fs.readdirSync(p).forEach(function (f) {
        self.include(p + f);
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
  var self = this,
      opt = this.options;
  opt.basepath = this._fullPath(opt.basepath);
  opt.basepath += (opt.basepath[opt.basepath.length-1] !== '/' ? '/' : '');
  this._exclude();
  var relpath = opt.main.replace(/^\.\//, '').replace(new RegExp('^'+opt.basepath), '');

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

Renderer.prototype.watch = function(done) {
  var self = this;
  this._exclude();
  this.paths.forEach(function(p) {
    fs.watchFile(p, { interval: 500 }, function(curr, prev) {
      console.log('File changed: ' +p+' at ' + curr.mtime);
      self.render(done);
    });
  });
  this.render(done);
};

Renderer.prototype._render = function(filepath) {
  var source = fs.readFileSync(filepath, 'utf8'),
      relpath = filepath.replace(new RegExp('^'+this.options.basepath), '');

  return 'require.modules[\'' + relpath + '\'] = '
    + 'function(module, exports, require, global){\n' + source + '\n};';
};

Renderer.prototype._fullPath = function(p) {
  if(p.substr(0, 2) == './') {
    p = path.normalize(this.options.reqpath + '/' + p);
  }
  return p;
}

module.exports = Renderer;
