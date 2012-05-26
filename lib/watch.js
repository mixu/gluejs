var fs = require('fs');

function Watch(paths, callback) {
  paths.forEach(function(p) {
    fs.watchFile(p, { interval: 200 }, function(curr, prev) {
      console.log('the current mtime is: ' + curr.mtime);
      console.log('the previous mtime was: ' + prev.mtime);
      callback(p);
    });
  });
}


