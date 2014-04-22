var fs = require('fs'),
    vm = require('vm'),
    path = require('path'),
    assert = require('assert'),
    reqWrap = require('../lib/require/index.js');

function stringify(value) {
  if(typeof value === 'function') {
    return value.toString();
  }
  if(value.toString() === '[object Object]') {
    return JSON.stringify(value, null, 2);
  }
  return value.toString();
}

function convert(arr) {
  var result = '[\n';
  result += arr.map(function(pack) {
    return '  {\n' + Object.keys(pack).map(function(key) {
      var value = pack[key];
      return '    ' + JSON.stringify(key) + ': ' + stringify(value);
    }).join(',\n') + '\n  }';
  }).join(',\n');
  result += '\n]';
  return result;
}


function createCode(opts) {
  var str = reqWrap.prelude(opts);
  // 2) module definitions
  str += 'r.m = ' + convert(opts.packages) + ';\n';
  str += reqWrap.postlude(opts);
  return str;
}

function box() {
  var sandbox = { exports: {}, console: console };
  sandbox.module = sandbox;
  sandbox.global = sandbox;
  return sandbox;
}

// test matrix:
// - `node` and `umd` should work equally well
// - `min` and `max` versions should work equally well
['node', 'umd'].forEach(function(exportType) {
  ['max', 'min'].forEach(function(minType) {
    exports[exportType + ' ' + minType + ' require tests'] = tests({
      type: exportType,
      require: minType
    });
  });
});

function tests(defaultOpts) {
  return {
    'can require() a local file': function() {
      var code = createCode({

        type: defaultOpts.type,
        'root-file': 'index.js',
        'global-require': false,
        'export': 'App',
        require: defaultOpts.require,

        packages: [{
          "index.js": function(module, exports, require){
            module.exports = 'index.js';
          }
        }]
      });

      var sandbox = box();
      // console.log(code);
      vm.runInNewContext(code, sandbox);

      assert.equal(sandbox.exports, 'index.js');
    },

    'can require() a file in a different package': function() {
      var code = createCode({
        type: defaultOpts.type,
        'root-file': 'index.js',
        'global-require': false,
        'export': 'App',
        require: defaultOpts.require,

        packages: [{
          "underscore": {"c":1,"m":"underscore.js"},
          "index.js": function(module, exports, require){
            module.exports = require('underscore');
          }
        },
        {
          "underscore.js": function(module, exports, require){
            module.exports = 'Underscore';
          }
        }]
      });

      var sandbox = box();
      //console.log(code);
      vm.runInNewContext(code, sandbox);

      assert.equal(sandbox.exports, 'Underscore');

    },

    'can require a path in a different package': function() {
      // TODO
    },

    'try to use the previous require function for unknown modules': function() {
      var code = createCode({
        type: defaultOpts.type,
        'root-file': 'index.js',
        'global-require': false,
        'export': 'App',
        require: defaultOpts.require,

        packages: [{
          "index.js": function(module, exports, require){
            module.exports = require('foobar');
          }
        }]
      });

      var calls = 0;

      var sandbox = box();
      sandbox.require = function() {
        calls++;
        return 'called';
      };
      vm.runInNewContext(code, sandbox);

      assert.equal(sandbox.exports, 'called');
      assert.equal(calls, 1);
    },

    'can chain requires': function() {

      // first block should fall back to the root require()
      // first block should export a require() implementation
      // second block should export a require() implementation
      // second block should fall back to the first require()

      // this requires moving from code that runs inside the anon func
      // to moving to window.foo = (function() { return require('main'); }());

      var code;

      // code = "function require(name) { console.log('ROOT: ' + name); return 'OK ' + name; };";
      code = "function require(name) { return 'OK ' + name; };";

      code += createCode({
        type: defaultOpts.type,
        'root-file': 'index.js',
        'global-require': true,
        'export': 'App',
        require: defaultOpts.require,

        packages: [{
          "index.js": function(module, exports, require){
            module.exports = require('abc');
          }
        }]

      });

      var calls = 0;
      var sandbox = box();

      code += createCode({
        type: defaultOpts.type,
        'root-file': 'index.js',
        'global-require': true,
        'export': 'App',
        require: defaultOpts.require,

        packages: [{
          "index.js": function(module, exports, require){
            module.exports = require('def');
          }
        }]

      });

      var sandbox2 = box();

      code += "result = require('foobar');"

      // console.log(code);

      vm.runInNewContext(code, sandbox2);

      assert.equal(sandbox2.result, 'OK foobar');
    }

    // TODO: test various code paths when exporting a require function
    // - require('./index.js')
    // - require('innermodule')
    // - require('./long/path/../foo.js')
  };
}

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [
    '--colors', '--ui', 'exports', '--reporter', 'spec', __filename
  ]);
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

