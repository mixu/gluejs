var fs = require('fs'),
    path = require('path');

function Tree() {
  this.files = [];
}

Tree.prototype.add = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
    p = path.normalize(p); // for windows
    var isDirectory = fs.statSync(p).isDirectory();

    if (isDirectory) {
      p += (p[p.length-1] !== path.sep ? path.sep : '');
      return fs.readdirSync(p).forEach(function (f) {
        self.add(p + f);
      });
    }
    self.files.push({ name: p });
  });
  // sort on each add
  self.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return this;
};

module.exports = Tree;
