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
  var str = '';
  // 0) global scope code
  str += opts.global || 'module.exports = ';
  // 1) preamble
  str += opts.pre || '(function(){\n';
  // 2) require implementation
  str += 'var r = ' + fs.readFileSync('../lib/require/require.js');
  // 3) module definitions
  str += 'r.m = ' + convert(opts.packages) + ';\n';
  // 4) globals block
  str += opts.code;
  // 5) post
  str += opts.post || '}());\n';
  return str;
}

function box() {
  var sandbox = { exports: {}, console: console };
  sandbox.module = sandbox;
  sandbox.global = sandbox;
  return sandbox;
}

exports['require tests'] = {

  'can require() a local file': function() {
    var code = createCode({
      packages: [{
        "index.js": function(module, exports, require){
          module.exports = 'index.js';
        }
      }],
      code: "return r('index.js');\n",
    });

    var sandbox = box();
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
      code: "return r('index.js');\n",
    });

    var sandbox = box();
    //console.log(code);
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
      code: "return r('index.js');\n",
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

    code = "function require(name) { console.log('ROOT: ' + name); return 'OK ' + name; };";

    code += createCode({
      global: 'require = ',
      packages: [{
        "index.js": function(module, exports, require){
          module.exports = require('foobar');
        }
      }],
      // export the require() function rather than the module itself
      code: "return r.relative('', 0);\n"
    });

    var calls = 0;
    var sandbox = box();

    code += createCode({
      global: 'require = ',
      packages: [{
        "index.js": function(module, exports, require){
          module.exports = require('foobar');
        }
      }],
      // export the require() function rather than the module itself
      code: "return r.relative('', 0);\n",
    });

    var sandbox2 = box();

    code += "result = require('index.js');"

    // console.log(code);

    vm.runInNewContext(code, sandbox2);

    assert.equal(sandbox2.result, 'OK foobar');
  }

  // TODO: test various code paths when exporting a require function
  // - require('./index.js')
  // - require('innermodule')
  // - require('./long/path/../foo.js')

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

