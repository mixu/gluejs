var fs = require('fs'),
    path = require('path');

module.exports = function(opts, onDone) {
  var files = opts.files,
      out = opts.out,
      main = opts.main,
      basepath = opts.basepath;

  // convert to deps format

  // search for vendor file paths using amdresolve and process `foo!path` directives



  // sort so that files are in an order that can be loaded safely
  // and that vendor files are before app files


  // wrap each file in AMD


};
