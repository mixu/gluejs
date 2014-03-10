var fs = require('fs');

  // `root-file`: the expression
  // Type:
  // - `global` (plain global)
  // - `node` (module.exports)
  // - `umd` (node/amd/global)
  //
  // Option: `global-require`

function check(opts) {
  if(!opts.type ||
     !opts['root-file'] ||
     typeof opts['global-require'] === 'undefined' ||
     !opts['export']) {
    throw new Error('Invalid opts: ' + JSON.stringify(opts, 2));
  }
}

exports.prelude = function(opts) {
  var str = '';
  check(opts);
  str += '(function(){\n';
  // 1) require implementation
  if(opts.require === 'max') {
    str += fs.readFileSync(__dirname +'/require.js');
  } else {
    str += fs.readFileSync(__dirname +'/require.min.js');
  }
  return str;
};

exports.postlude = function(opts) {
  var str = '';
  check(opts);
  // 3) code block to export values
  switch(opts.type) {
    case 'node':
      str += 'module.exports = r(' + JSON.stringify(opts['root-file'])  +');';
      break;
    case 'global':
      str += opts['export'] + ' = r(' + JSON.stringify(opts['root-file'])  +');';
      break;
    case 'umd':
      if(opts.require === 'max') {
        str += fs.readFileSync(__dirname +'/umd.js');
      } else {
        str += fs.readFileSync(__dirname +'/umd.min.js');
      }
      str += 'umd(r(' + JSON.stringify(opts['root-file'])  +'), ' + JSON.stringify(opts['export']) + ');';
      break;
  }
  if(opts['global-require']) {
    str += 'require = r.relative("", 0);\n';
  }
  str += '}());\n';
  return str;
};
