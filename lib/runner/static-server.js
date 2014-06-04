var http = require('http'),
    annotateBasepath = require('../list-tasks/annotate-basepath.js');

module.exports = function(list, options) {
  // infer the basepath (longest common string)
  annotateBasepath(list);

  http.createServer(function(req, res) {
    if(req.url == '/') {
      res.end('<html><ul><li>'+ list.files.map(function(file) {
        return file.name.substr(list.basepath.length);
      }).join('</li><li>') +'</li></ul></html>');
    } else {
      res.end('Unknown: ' + req.url);
    }
  }).listen(8000).on('listening', function() {
    console.log('Listening on localhost:8000');
  });
};
