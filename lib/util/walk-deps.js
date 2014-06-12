function walkDeps(start, files, onEach) {
  var lookup = { };

  files.forEach(function(file) {
    lookup[file.id] = file;
  });

  var seen = { },
      stack = [lookup[start]];

  function unseen(dep) { return !seen[dep] && lookup[dep]; }
  function fromLookup(dep) { return lookup[dep]; }

  while (stack.length > 0) {
    current = stack.pop();
    if (!seen[current.id]) {
      seen[current.id] = true;
      onEach(current);
      stack.push.apply(stack,
        current.deps
          .filter(unseen)
          .map(fromLookup)
      );
    }
  }
}

module.exports = walkDeps;
