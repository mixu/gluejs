function SortDependencies() {
  this.items = [];
  this.resolved = {};
}

SortDependencies.prototype.add = function(item) {
  this.items.push(item);
};

SortDependencies.prototype.resolve = function(name) {
  if(typeof name === 'object' && name.name) {
    name = name.name;
  }
  this.resolved[name] = true;
};

SortDependencies.prototype.isEmpty = function() {
  return this.items.length == 0;
};

SortDependencies.prototype.ignoreResolved = function(item) {
  var self = this;
  return item.deps.reduce(function(prev, current) {
    return prev + (!self.resolved[current] ? 1 : 0);
  }, 0);
};

SortDependencies.prototype.next = function() {
  var self = this;
  this.items.sort(function(a, b) {
    var diff = self.ignoreResolved(b) - self.ignoreResolved(a);
    if (diff == 0) {
      return a.name.localeCompare(b.name);
    }
    return diff;
  });
  return this.items.pop();
};

SortDependencies.prototype.verify = function(item) {
  var self = this;
  return item.deps.filter(function(name) {
    return !self.resolved[name];
  });
};

module.exports = SortDependencies;
