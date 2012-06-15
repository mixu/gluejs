var assert = require('assert'),
    Glue = require('../lib/glue.js');

exports['glue'] = {
  'test': function(done) {
    var packageA = new Glue()
          .basepath('./fixtures/')
          .export('module.exports')
          .include('./fixtures/lib/simple.js');
    var packageB = new Glue()
          .basepath('./fixtures/')
          .export('module.exports')
          .include('./fixtures/lib/simple.js');

    Glue.concat([packageA, packageB], function(err, txt) {
      console.log(txt);
    });
    done();
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
