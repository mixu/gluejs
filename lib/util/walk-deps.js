function walkDeps(start, files, onEach) {
  var lookup = { };

  files.forEach(function(file) {
    lookup[file.id] = file;
  });

  var seen = { },
      stack = [ lookup[start] ];

  while (stack.length > 0) {
    current = stack.pop();
    if(!seen[current.id]) {
      seen[current.id] = true;
      onEach(current);
      stack.push.apply(stack,
        current.deps
          .filter(function(dep) { return !seen[dep] && lookup[dep]; })
          .map(function(dep) { return lookup[dep]; })
      );
    }
  }
}

module.exports = walkDeps;
