var annotateLookup = require('../../list-tasks/annotate-lookup.js');
// takes a list.packages object and produces a summary of packages
// their relative sizes and total size

function kbs(size) {
  return (size / 1024).toFixed(2);
}

function percentage(size, total) {
  return Math.floor(size / total * 100 );
}


module.exports = function(list) {
  // add list.lookup
  annotateLookup(list);

  // calculate the totals - need this information to display percentage sizes of files
  var totalsByPackageIndex = [],
      total = 0;
  list.packages.forEach(function(pack, index) {
    totalsByPackageIndex[index] = pack.files.reduce(function(prev, relname) {
      var item = list.lookup[pack.basepath + relname];
      return prev + item.stat.size
    }, 0);
    total += totalsByPackageIndex[index];
  });




  list.packages.forEach(function(pack, index) {
    var pTotal = totalsByPackageIndex[index];
    console.log('# ' + (pack.name ? pack.name : 'Root package'));
    pack.files.forEach(function(relname) {
      var fullpath = pack.basepath + relname,
          item = list.lookup[fullpath];
      console.log('  '+relname+' '+ kbs(item.stat.size)+'k '+percentage(item.stat.size, total) + '%');
    });
    console.log('Package total: ' + kbs(pTotal)+'k '+percentage(pTotal, total)+'%');

    if(Object.keys(pack.dependencies).length > 0) {
      console.log('Package dependencies: ' +Object.keys(pack.dependencies).join(', '));
    }
  });

  console.log('Total size: ' + kbs(total)+'k');
};
