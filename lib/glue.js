var fs = require('fs'),
    path = require('path'),
    Package = require('./package'),
    Group = require('./group'),
    Minilog = require('minilog'),
    log = Minilog('glue');

var requireCode = fs.readFileSync(__dirname + '/require/require.new.min.js', 'utf8')
  .replace(/\/*([^/]+)\/\n/g, '');

var defaults = {
  main: 'index.js',
  reqpath: ''
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
  this._concatFiles = [];
};

// options: debug
Renderer.prototype.set = function(key, val){
  if(key == 'debug') {
    this.build.set(key, val);
  }
  this.options[key] = val;
  return this;
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
  if(arguments.length == 1 || typeof pathTo == 'undefined') {
    this.build.dependency(this._fullPath(name));
  } else {
    this.build.dependency(name, this._fullPath(pathTo));
  }
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

// make it easier to inspect the output by returning it as a object
Renderer.prototype._render = function(onDone) {
  var self = this;
  this._updateBasePath();

  this.build.files = this.files.resolve();

  var result = [];
  this.build.render(result, function(pkgId) {
    var relpath = self.build.main.replace(/^\.\//, '').replace(new RegExp('^' +
       (path.sep == '\\' ? self.build.basepath.replace(/\\/g, '\\\\') : self.build.basepath ) // windows
      ), '');
    onDone({
      replaced: self.replaced,
      code: self.code,
      modules: result,
      exportLine: self.options.export + ' = require(\'' +  relpath + '\');'
    });
  });
  return this;
};

Renderer.prototype.render = function(onDone){
  var self = this;
  this._render(function(out) {
    // place replaced modules into modules[0]
    Object.keys(out.replaced).forEach(function(key) {
      out.modules[0][key] = '{ exports: ' + out.replaced[key] + ' }';
    });
    // place injected code into modules[0]
    Object.keys(out.code).map(function(moduleName) {
      out.modules[0][moduleName] = 'function(module, exports, require){' + out.code[moduleName] + '}\n';
    });
    onDone(undefined, '(function(){'
      + requireCode
      + '\nrequire.m = [];\n'
      + out.modules.reduce(function(str, o, counter) {
        var keys = [];
        Object.keys(o).sort().map(function(name){
          keys.push(JSON.stringify(name)+': '+o[name]);
        });
        return str + 'require.m['+counter+'] = { ' + keys.join(',\n') + '};\n';
      }, '')
      // name to export
      + out.exportLine + '\n'
      + '}());'
      + self._concatFiles.map(function(fpath) {
        log.debug('Concatenating', fpath);
        return fs.readFileSync(fpath);
      }).join(''));
  });
};

Renderer.prototype.watch = function(onDone) {
  var self = this;
  this._updateBasePath();

  var paths = this.files.resolve();

  paths.forEach(function(p) {
    fs.watchFile(p, { interval: 500 }, function(curr, prev) {
      if(curr.mtime.valueOf() == prev.mtime.valueOf()) return;
      log.info('File changed: ' +p+' at ' + curr.mtime);
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
  basepath += (basepath[basepath.length-1] !== path.sep ? path.sep : '');
  this.build.basepath = basepath;
}

Renderer.prototype._fullPath = function(p) {
  if(typeof p != 'string') {
    throw new Error('Path is not a string: '+p);
  }
  if(p.substr(0, 1) == '.') {
    p = path.normalize(this.options.reqpath + path.sep + p);
  }
  return p;
};

Renderer.prototype.concat = function(filepath) {
  this._concatFiles.push(filepath);
  return this;
};

Renderer.concat = function(arr, callback) {
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
