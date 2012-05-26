var Glue = require('../lib/glue.js');

new Glue()
  .include('./tmp/placeholder.txt')
  .export('App')
  .watch(function(err, txt) {
//    console.log(txt);
  });
