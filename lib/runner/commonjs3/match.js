var fs = require('fs'),
    path = require('path');

function strToRegEx(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

module.exports = function(expr, opts) {
  var expr = (Array.isArray(expr) ? expr : [ expr ]),
      basepath = opts.basepath;

  function pathString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    // resolve relative strings to absolute strings
    if (str.charAt(0) === '.') {
      str = path.resolve(basepath, str);
    }
    // and convert the strings to regular expressions
    var stat = fs.statSync(str);
    // files get exact match, while directories match everything starting with their name
    if (stat.isFile()) {
      return new RegExp('^' + str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + '$');
    }
    return new RegExp('^' + str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + '.*$');
  }

  expr = expr.map(pathString);

  var result = function(filename, log) {
    return expr.some(function(re) {
      var isMatch = re.test(filename);
      if (isMatch) {
        return re;
      }
      return false;
    });
  };

  result.add = function(e) {
    if (typeof e === 'string') {
      e = pathString(e);
    }
    expr.push(e);
  };

  return result;
};
