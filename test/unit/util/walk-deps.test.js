var assert = require('assert'),
    util = require('util');

var walkDeps = require('../../../lib/util/walk-deps.js');

function factor(entries, files, opts) {
  var threshold = (opts && opts.threshold ? opts.threshold : 2),
      bundles = entries.reduce(function(prev, entry) { prev[entry] = []; return prev; }, {}),
      common = {};

  entries.forEach(function(entry) {
    walkDeps(entry, files, function(file) {
      if (!file.usedBy) {
        file.usedBy = [ entry];
      } else {
        file.usedBy.push(entry);
      }
      if (file.usedBy.length === threshold) {
        common[file.id] = file;
      }
      if (!common[file.id]) {
        bundles[entry].push(file);
      }
    });
  });
  // filter out common files (which may have been added pre-threshold)
  Object.keys(bundles).forEach(function(key) {
    if (key == 'common') {
      return;
    }
    bundles[key] = bundles[key].filter(function(file) {
      return !common[file.id];
    });
  });

  bundles.common = Object.keys(common).map(function(key) {
    return common[key];
  });

  return bundles;
}

function formatFactor(bundles) {
  Object.keys(bundles).forEach(function(key) {
    bundles[key] = bundles[key].map(function(file) {
      return file.id;
    }).sort();
  });
  return bundles;
}

exports['tests'] = {

  'it works': function() {
    var files = [
      { id: 'a', deps: [ 'b' ] },
      { id: 'b', deps: [ 'c' ] },
      { id: 'c', deps: [ ] },
      { id: 'x', deps: [ ] }
    ];

    var expected = [ 'a', 'b', 'c' ],
        actual = [];

    walkDeps('a', files, function(file) {
      actual.push(file.id);
    });

    assert.deepEqual(actual.sort(), expected);
  },

  'fork': function() {
    var files = [
      { id: 'a', deps: [ 'b', 'c' ] },
      { id: 'b', deps: [ 'd', 'e' ] },
      { id: 'c', deps: [ 'f', 'g' ] },
      { id: 'd', deps: [] },
      { id: 'e', deps: [] },
      { id: 'f', deps: [] },
      { id: 'g', deps: [] },
      { id: 'x', deps: [] }
    ];

    var expected = [ 'a', 'b', 'c', 'd', 'e', 'f', 'g' ],
        actual = [];

    walkDeps('a', files, function(file) {
      actual.push(file.id);
    });
    assert.deepEqual(actual.sort(), expected);
  },

  'circular': function() {
    var files = [
      { id: 'a', deps: [ 'b' ] },
      { id: 'b', deps: [ 'c' ] },
      { id: 'c', deps: [ 'a' ] }
    ];

    var expected = [ 'a', 'b', 'c' ],
        actual = [];

    walkDeps('a', files, function(file) {
      actual.push(file.id);
    });

    assert.deepEqual(actual.sort(), expected);
  },

  'dup paths': function() {
    var files = [
      { id: 'a', deps: [ 'a', 'b', 'c' ] },
      { id: 'b', deps: [ 'a', 'b', 'c' ] },
      { id: 'c', deps: [ 'a', 'b', 'c' ] }
    ];

    var expected = [ 'a', 'b', 'c' ],
        actual = [];

    walkDeps('a', files, function(file) {
      actual.push(file.id);
    });

    assert.deepEqual(actual.sort(), expected);
  },

  'basic factor': function() {
    var files = [
      { id: 'a', deps: [ 'c' ] },
      { id: 'b', deps: [ 'c', 'd' ] },
      { id: 'c', deps: [ ] },
      { id: 'd', deps: [ ] }
    ];

    // c is common
    var expected = {
      common: [ 'c' ],
      a: ['a'],
      b: ['b', 'd']
    };

    var actual = formatFactor(factor(['a', 'b'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.a, expected.a);
    assert.deepEqual(actual.b, expected.b);

  },

  'deeper factor': function() {
    var files = [
      { id: 'a', deps: [ 'c', 'x' ] },
      { id: 'b', deps: [ 'c', 'd' ] },
      { id: 'c', deps: [ ] },
      { id: 'd', deps: [ ] },
      { id: 'x', deps: [ 'd' ] }
    ];
    // c and d are common, x is not
    var expected = {
      common: [ 'c', 'd' ],
      a: ['a', 'x'],
      b: ['b']
    };
    var actual = formatFactor(factor(['a', 'b'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.a, expected.a);
    assert.deepEqual(actual.b, expected.b);

  },

  'same modules included twice': function() {
    var files = [
      { id: 'a', deps: [ 'b', 'c' ] },
      { id: 'b', deps: [ ] },
      { id: 'c', deps: [ 'b' ] }
    ];
    // no common, if you only run from a
    var expected = {
      common: [ ],
      a: ['a', 'b', 'c']
    };

    var actual = formatFactor(factor(['a'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.a, expected.a);
  },

  'nested entry': function() {
    var files = [
      { id: 'a', deps: [ 'b', 'c' ] },
      { id: 'b', deps: [ 'c'] },
      { id: 'c', deps: [ ] }
    ];
    // no common, if you only run from a
    var expected = {
      common: [ 'b', 'c' ],
      a: ['a'],
      b: []
    };

    var actual = formatFactor(factor(['a', 'b'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.a, expected.a);
  },

  'threshold': function() {
    var files = [
      { id: 't', deps: [ 'a', 'w' ] },
      { id: 'w', deps: [ 'a', 'z' ] },
      { id: 'y', deps: [ 'z' ] },
      { id: 'a', deps: [ ] },
      { id: 'z', deps: [ ] },
    ];
    // common: z
    var expected = {
      common: [ 'z' ],
      t: [ 'a', 't', 'w' ],
      y: [ 'y' ]
    };
    var actual = formatFactor(factor(['t', 'y'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.t, expected.t);
    assert.deepEqual(actual.y, expected.y);
  },

  'lift': function() {
    var files = [
      { id: 'a', deps: [ 'c', 'z' ] },
      { id: 'b', deps: [ 'c', 'x' ] },
      { id: 'c', deps: [ 'd' ] },
      { id: 'd', deps: [ 'e' ] },
      { id: 'e', deps: [ ] },
      { id: 'x', deps: [ 'y' ] },
      { id: 'y', deps: [ 'z' ] },
      { id: 'z', deps: [ 'c' ] }
    ];

    var expected = {
      common: [ 'c', 'd', 'e', 'z' ],
      a: [ 'a' ],
      b: [ 'b', 'x', 'y' ]
    };
    var actual = formatFactor(factor(['a', 'b'], files));
    assert.deepEqual(actual.common, expected.common);
    assert.deepEqual(actual.t, expected.t);
    assert.deepEqual(actual.y, expected.y);
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
