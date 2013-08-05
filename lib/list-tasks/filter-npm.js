var log = require('minilog')('filter-npm');
// This task prunes a file list based on three things:
// 1) npm's built-in ignore list <== Applied by filter-npm
// 2) package.json's files field <=\
// 3) .npmignore files           <== Application is scoped to a project - applied by filter-project after infer-packages
// 4) .gitignore files           <=/
//
// The end result is that files that would be excluded by npm publish are dropped from the list.

module.exports = function(list) {
  list.files = list.files.filter(function(obj, i) {
    var name = obj.name;
    if(
        name.match(new RegExp('/node_modules/[.]bin/')) || // this one is nonstandard but useful
        name.match(new RegExp('/[.]git/')) ||
        name.match(new RegExp('[.]lock-wscript$')) ||
        name.match(/\/[.]wafpickle-[0-9]+$/) ||
        name.match(new RegExp('/CVS/')) ||
        name.match(new RegExp('/[.]svn/')) ||
        name.match(new RegExp('/[.]hg/')) ||
        name.match(/\/[.].*[.]swp$/) ||
        name.match(new RegExp('[.]DS_Store$')) ||
        name.match(/\/[.]_/) ||
        name.match(new RegExp('npm-debug[.]log$'))
      ) {
      // 1) npm's built-in ignore list
      log.info('Excluded by npm\'s built-in ignore list:', name);
      return false;
    }
    return true;
  });
};
