var fs = require('fs');

// A set of file/folder paths defined as:
// - include(path/file)
// - exclude(regexp)
// - operation(regexp, function)

function Group() {
  this.paths = [];
  this.excluded = [];
  this.handlers = [];
}

Group.prototype.include = function(filepath){
  if(!filepath) return this;
  var self = this,
      paths = (Array.isArray(filepath) ? filepath : [ filepath ]);

  paths.forEach(function(p) {
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

Group.prototype.exclude = function(module) {
  this.excluded.push(module);
  return this;
};

// Exclude paths based on expressions (done just before rendering)
Group.prototype._exclude = function() {
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

Group.prototype.handler = function(regex, fn) {
  this.handlers.push({ re: regex, handler: fn});
  return this;
};

Group.prototype.watch = function(onDone) {
  var self = this;
  this._exclude();
  this.paths.forEach(function(p) {
    fs.watchFile(p, { interval: 500 }, function(curr, prev) {
      console.log('File changed: ' +p+' at ' + curr.mtime);
      self.exec(onDone);
    });
  });
  self.exec(onDone);
};

// Actually executes the actions.
// Each handler gets called once for each file that matches the regex.
Group.prototype.exec = function(onDone) {
  var self = this,
      result = '',
      tasks = [];
  this._exclude();
  this.paths.sort();
  this.handlers.forEach(function(o) {
    var matching = self.paths.filter(function(filepath) { return o.re.test(filepath); });
    matching.forEach(function(filepath) {
      tasks.push( function(done) {
        o.handler(filepath, function(data) {
          result += data;
          done();
        });
      });
    });
  });
  // serial execution
  function run(callable) {
    if(callable) {
      callable(function() {
        return run(tasks.shift());
      });
    } else {
      return onDone(undefined, result);
    }
  }
  return run(tasks.shift());
};

module.exports = Group;
