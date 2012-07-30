var fs = require('fs'),
    path = require('path'),
    Package = require('./package');
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
  // Package
  this.build = new Package();
  this.build.basepath = options.reqpath = defaults.reqpath;
  this.build.main = defaults.main;
  // The root package is unusual in that it has files that are defined piecemeal
  this.files = new Group();

  this.options = options;
  this.replaced = {};
  this.code = {};
};

// redirect include / exclude / watch to the group
Renderer.prototype.include = function(f) { this.files.include(this._fullPath(f)); return this; };
Renderer.prototype.exclude = function(f) { this.files.exclude(f); return this; };
Renderer.prototype.handler = function(regex, fn) {
  this.build.handlers.push({ re: regex, handler: fn});
  return this;
};

Renderer.prototype.npm = function(name, pathTo) {
  // add the dependency -- on the package (which adds sub-dependencies etc.)
  this.build.dependency(name, pathTo);
  return this;
};

['export', 'reqpath'].forEach(function(key) {
  Renderer.prototype[key] = function(value) {
    this.options[key] = value;
    return this;
  };
});

['main', 'basepath'].forEach(function(key) {
  Renderer.prototype[key] = function(value) {
    this.build[key] = value;
    return this;
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

  this.build.files = this.files.resolve();

  var result = [];
  this.build.render(result, function(pkgId) {

//    console.log(self.build, result);

    var relpath = self.build.main.replace(/^\.\//, '').replace(new RegExp('^'+self.build.basepath), '');
    onDone(undefined, '(function(){'
      + requireCode
      + '\n'
      // replaced modules
      + Object.keys(self.replaced).reduce(function(str, key) {
        var value = self.replaced[key];
        return str + 'require.modules[0]["' + key + '"] = { exports: ' + value + ' };\n';
      }, '')
      // injected code
      + Object.keys(self.code).reduce(function(str, moduleName) {
        return str + self.wrap(moduleName, self.code[moduleName]);
      }, '')
      // root package (and all its children)
      + result.reduce(function(str, o, counter) {
        return str + Object.keys(o).reduce(function(s, name){
          return s + 'require.modules['+counter+']['+JSON.stringify(name)+'] = '+o[name];
        }, '');
      }, '')
      // name to export
      + self.options.export + ' = require(\'' +  relpath + '\');\n'
      + '}());');
  });
};

Renderer.prototype.watch = function(onDone) {
  var self = this;
  this._updateBasePath();

  var paths = this.build.resolve();

  paths.forEach(function(p) {
    fs.watchFile(p, { interval: 500 }, function(curr, prev) {
      if(curr.mtime.valueOf() == prev.mtime.valueOf()) return;
      console.log('File changed: ' +p+' at ' + curr.mtime);
      if(self.watchTimer) return;
      self.watchTimer = setTimeout(function() {
        self.render(onDone);
        self.watchTimer = null;
      }, 500);
    });
  });
  this.render(onDone);
};

Renderer.prototype._updateBasePath = function() {
  var basepath = this.build.basepath;
  basepath = this._fullPath(basepath);
  basepath += (basepath[basepath.length-1] !== '/' ? '/' : '');
  this.build.basepath = basepath;
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
