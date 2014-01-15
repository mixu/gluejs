var fs = require('fs'),
    vm = require('vm'),
    path = require('path'),
    assert = require('assert');

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
  // 1) preamble
  var str = opts.pre || '(function(){\n';
  // 2) require implementation
  str += fs.readFileSync('../lib/require/require.js');
  // 3) module definitions
  str += 'require.m = ' + convert(opts.packages) + ';\n';
  // 4) globals block
  str += opts.code;
  // 5) post
  str += opts.post || '}());\n';
  return str;
}


exports['require tests'] = {

  'can require() a local file': function() {
    var code = createCode({
      packages: [{
        "index.js": function(module, exports, require){
          module.exports = 'index.js';
        }
      }],
      code: "module.exports = require('index.js');\n",
    });

    var sandbox = { exports: {} };
    sandbox.module = sandbox;
    sandbox.global = sandbox;
    vm.runInNewContext(code, sandbox);

    assert.equal(sandbox.exports, 'index.js');
  },

  'can require() a file in a different package': function() {
    var code = createCode({
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
      }],
      code: "module.exports = require('index.js');\n",
    });

    var sandbox = { exports: {} };
    sandbox.module = sandbox;
    sandbox.global = sandbox;

    vm.runInNewContext(code, sandbox);

    assert.equal(sandbox.exports, 'Underscore');

  },

  'try to use the previous require function for unknown modules': function() {
    var code = createCode({
      packages: [{
        "index.js": function(module, exports, require){
          module.exports = require('foobar');
        }
      }],
      code: "module.exports = require('index.js');\n",
    });

    var calls = 0;
    var sandbox = { exports: {}, require: function() {
      calls++;
      return 'called';
    } };
    sandbox.module = sandbox;
    sandbox.global = sandbox;
    vm.runInNewContext(code, sandbox);

    assert.equal(sandbox.exports, 'called');
    assert.equal(calls, 1);
  },

  'can chain requires': function() {

  }

};

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

