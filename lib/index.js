var Minilog = require('minilog');

var styles = {
  //styles
  'bold'      : ['\033[1m',  '\033[22m'],
  'italic'    : ['\033[3m',  '\033[23m'],
  'underline' : ['\033[4m',  '\033[24m'],
  'inverse'   : ['\033[7m',  '\033[27m'],
  //grayscale
  'white'     : ['\033[37m', '\033[39m'],
  'grey'      : ['\033[90m', '\033[39m'],
  'black'     : ['\033[30m', '\033[39m'],
  //colors
  'blue'      : ['\033[34m', '\033[39m'],
  'cyan'      : ['\033[36m', '\033[39m'],
  'green'     : ['\033[32m', '\033[39m'],
  'magenta'   : ['\033[35m', '\033[39m'],
  'red'       : ['\033[31m', '\033[39m'],
  'yellow'    : ['\033[33m', '\033[39m']
},
levelMap = { debug: 1, info: 2, warn: 3, error: 4 };

function style(str, style) {
  return styles[style][0] + str + styles[style][1];
}

Minilog.pipe(Minilog.backends.nodeConsole).format(function(name, level, args) {
  var colors = { debug: 'blue', info: 'cyan', warn: 'yellow', error: 'red' };
  return (name ? style(name +' ', 'grey') : '')
          + (level ? style(level, colors[level]) + ' ' : '')
          + args.join(' ');
});

module.exports = require('./glue.js');

module.exports.defaults({ 'reqpath': require('path').dirname(require.cache[__filename].parent.filename) });
