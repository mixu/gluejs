var assert = require('assert');
    util = require('util'),
    FixtureGen = require('../../lib/fixture-gen.js');

var stat = require('../../../lib/list-tasks/annotate-stat.js'),
    List = require('minitask').list;

exports['annotate-stat'] = {

  before: function() {
    this.fixture = new FixtureGen();
  },

  'can stat the list': function(done) {

    var inDir = this.fixture.dir({
      'simple.js': 'exports.simple = true;\n'
    });

    var list = new List();

    list.add(inDir);

    list.exec(function(err, files) {

      stat({ files: files });
      //console.log(util.inspect(files, null, 10, true));
      // each file has a stat property now
      assert.ok(files.every(function(file) {
        return typeof file.stat == 'object';
      }));
      done();
    });
  }
};


