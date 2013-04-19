var fs = require('fs'),
    path = require('path');

// A set of file/folder paths defined as:
// - include(path/file)
// - exclude(regexp)

function Group() {
  this.paths = [];
  this.excluded = [];
  this.watchTimer = null;
}

Group.prototype.include = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
    p = path.normalize(p); // for windows
    var isDirectory = fs.statSync(p).isDirectory();

    if (isDirectory) {
      p += (p[p.length-1] !== path.sep ? path.sep : '');
      return fs.readdirSync(p).forEach(function (f) {
        self.include(p + f);
      });
    }
    self.paths.push(p);
  });
  return this;
};

Group.prototype.exclude = function(module) {
  this.excluded.push(module);
  return this;
};

// Exclude paths based on expressions (done just before rendering)
Group.prototype._exclude = function() {
  var self = this;
  this.excluded.forEach(function(expr) {
    self.paths = self.paths.filter(function(p){
      if(expr.test) {   // regexp
          return !expr.test(p);
      }
      // string
      expr = path.normalize(expr);
      return (p.substr(p.length - expr.length) != expr);
    })
  });
};

Group.prototype.resolve = function(onDone) {
  var self = this;
  this._exclude();
  return this.paths.sort();
};

module.exports = Group;
