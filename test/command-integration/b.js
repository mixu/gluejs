var fs = require('fs'),
    brfs = require('brfs');

fs.createReadStream(__dirname + '/test.brfs.js')
  .pipe(brfs(__dirname + '/test.brfs.js')).pipe(process.stdout);
