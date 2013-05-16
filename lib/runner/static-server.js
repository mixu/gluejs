var http = require('http'),
    annotateBasepath = require('../tree-tasks/annotate-basepath.js');

module.exports = function(tree, options) {
  // infer the basepath (longest common string)
  annotateBasepath(tree);

  http.createServer(function(req, res) {
    if(req.url == '/') {
      res.end('<html><ul><li>'+ tree.files.map(function(file) {
        return file.name.substr(tree.basepath.length);
      }).join('</li><li>') +'</li></ul></html>');
    } else {
      res.end('Unknown: ' + req.url);
    }
  }).listen(8000).on('listening', function() {
    console.log('Listening on localhost:8000');
  });
};
