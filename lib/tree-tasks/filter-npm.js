// This task prunes a file tree based on three things:
// 1) npm's built-in ignore list
// 2) .npmignore files
// 3) .gitignore files
//
// The end result is that files that would be excluded by npm publish are dropped from the tree.

module.exports = function(tree) {
  tree.files = tree.files.filter(function(obj, i) {
    var name = obj.name;

    if(
        name.match(new RegExp('/\.git/')) ||
        name.match(new RegExp('\.lock-wscript$')) ||
        name.match(/\/\.wafpickle-[0-9]+$/) ||
        name.match(new RegExp('/CVS/')) ||
        name.match(new RegExp('/\.svn/')) ||
        name.match(new RegExp('/\.hg/')) ||
        name.match(/^\..*\.swp$/) ||
        name.match(new RegExp('\.DS_Store$')) ||
        name.match(/\/^\._/) ||
        name.match(new RegExp('npm-debug\.log$'))
      ) {
      // 1) npm's built-in ignore list
      return false;
    }
  });

  // find npmignore and gitignore files

};

