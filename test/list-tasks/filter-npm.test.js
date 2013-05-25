var assert = require('assert'),
    util = require('util');

var filter = require('../../lib/list-tasks/filter-npm.js');

var cases = {
  'built-in ignores': {

    files: [
      '/a/.git/config',
      '/a/.git/foo/bar',
      '/a/.lock-wscript',
      '/a/.lock-wscript-keepme',
      '/a/.wafpickle-1',
      '/a/.wafpickle-2-keepme',
      '/a/CVS/foo',
      '/a/.svn/foo',
      '/a/.hg/foo',
      '/a/.foobar.swp',
      '/a/keepme.swp',
      '/a/.DS_Store',
      '/a/.DS_Store/keepme',
      '/a/.DS_Store-keepme',
      '/a/._',
      '/a/npm-debug.log',
      '/a/npm-debug.log/keepme',
      '/a/npm-debug.log-keepme'
    ]

  }

};

Object.keys(cases).forEach(function(name) {
  cases[name].files = cases[name].files.map(function(file) { return { name: file }; });
});

exports['filter-npm'] = {

  'can exclude using the npm built-in ignore list': function() {
    var list = cases['built-in ignores'];
    filter(list);
    //console.log(util.inspect(list, null, 10, true));
    assert.deepEqual(list.files, [
      { name: '/a/.lock-wscript-keepme' },
      { name: '/a/.wafpickle-2-keepme' },
      { name: '/a/keepme.swp' },
      { name: '/a/.DS_Store/keepme' },
      { name: '/a/.DS_Store-keepme' },
      { name: '/a/npm-debug.log/keepme' },
      { name: '/a/npm-debug.log-keepme' }
    ]);
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) { if (/^execvp\(\)/.test(data)) console.log('Failed to start child process. You need mocha: `npm install -g mocha`') });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
