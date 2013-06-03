var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    Minimatch = require("minimatch").Minimatch;

// This task prunes a file list based on three things:
// 1) npm's built-in ignore list <== Applied by filter-npm
// 2) package.json's files field <=\
// 3) .npmignore files           <== Application is scoped to a project - applied by filter-project after infer-packages
// 4) .gitignore files           <=/
//
// The end result is that files that would be excluded by npm publish are dropped from the list.

// This function is ported from isaacs/fstream-ignore
function match(rules, fullpath) {
  var included = true;

  // console.log('--', fullpath);

  // it looks like the base logic in fstream-ignore basically relies on nested `parent.applyIgnores`
  // calls to exhaustively match the paths.
  // so we'll do the same thing here: split the entry by path parts,
  // then retry with every single alternative:
  // e.g. /a/b/c => [ c, 'b/c', 'a/b/c'].foreach(match)
  var parts = fullpath.substr(1).split('/').reverse(), entry = '';
  // note: [ c, b, a ] rather than [ a, b ] because reversed
  parts.some(function(next){
    entry = (entry == '' ? next : next + '/') + entry;

    rules.forEach(function(rule) {
      // negation means inclusion
      if (rule.negate && included ||  !rule.negate && !included) {
        // unnecessary
        return;
      }

      // first, match against /foo/bar
      var match = rule.match('/' + entry);
      // console.log('/' + entry, rule.pattern, match);

      if (!match) {
        // try with the leading / trimmed off the test
        // eg: foo/bar instead of /foo/bar
        match = rule.match(entry);
        // console.log(entry, rule.pattern, match);

        // Note: only try cases where entry is prefixed with a "/"
        // => otherwise, non-directories will match here (e.g. /examples/file.js
        // should not be matched as /examples/file.js/)
      }

      // since unlike fstream-ignore, we see the full paths for directories,
      // need to try against the basename as well
      // There are 4 options: plain, prefix, postfix, pre+postfix

      if (!match) {
        var dirname = path.dirname(entry);
        if(dirname != '.') {
          match = [
            dirname,
            '/'+dirname,
            dirname + '/',
            '/' + dirname + '/'
          ].some(function(permutation) {
            // console.log(permutation, rule.pattern);
            return rule.match(permutation);
          });
        }
      }

      if (match) {
        included = rule.negate;
      }
    });
    // quick return
    if(!included) return false;
  });

  return included;
}

module.exports = function(list) {
  // package.json, .npmignore and .gitignore are applied on a per-project basis
  // note that there can be multiple .gitignores inside a project

  var removed = [];
  // find the ignore files (applying them in the correct order)
  function traverse(packageObj) {
    // sort by length
    packageObj.files = packageObj.files.sort(function(a, b) { return a.name.length - b.name.length; } );
    var rules = [], raw,
        files = packageObj.files;

    // handle files
     if(files) {
      // scan for files matching
      files.forEach(function(item) {
        var fullpath = item.name;

        if(/\/package.json$/.test(fullpath)) {
          var p = JSON.parse(fs.readFileSync(fullpath));

          if(p.files && Array.isArray(p.files)) {
            // from https://github.com/isaacs/fstream-npm/blob/master/fstream-npm.js#L213
            raw = ["*"].concat(p.files.map(function (f) {
              return "!" + f
            })).concat(p.files.map(function (f) {
              return "!" + f.replace(/\/+$/, "") + "/**"
            }));

            raw = raw.map(function (s) {
              var m = new Minimatch(s, { matchBase: true, dot: true, flipNegate: true });
              m.ignoreFile = fullpath;
              return m;
            });

            rules = rules.concat(raw);
          }
        }


        if(/\/\.npmignore$/.test(fullpath) || /\/\.gitignore$/.test(fullpath)) {
          // ported from isaacs/fstream-ignore
          var set = fs.readFileSync(fullpath).toString().split(/\r?\n/);
          // filter comments and empty lines
          set = set.filter(function (s) {
            s = s.trim()
            return s && !s.match(/^#/)
          });

          raw = set.map(function (s) {
            var m = new Minimatch(s, { matchBase: true, dot: true, flipNegate: true });
            m.ignoreFile = fullpath;
            return m;
          });

          rules = rules.concat(raw);
        }
      });


      if(rules.length > 0) {
        packageObj.files = files.filter(function(item) {
          var name = item.name,
              result = match(rules, name);
          // also update list.files
          if(!result) {
            removed.push((packageObj.basepath ? packageObj.basepath : '')  + name);
          }
          return result;
        });
      }
    }
  }

  list.packages.forEach(traverse);

  // console.log(removed);
  // update files
  list.files = list.files.filter(function(obj) {
    return removed.indexOf(obj.name) == -1;
  });

};


// to override the fs module, which is only used for reading in package.json files
module.exports._setFS = function(newFs) {
  fs = newFs;
}
