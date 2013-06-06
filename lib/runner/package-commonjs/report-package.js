// takes a list.packages object and produces a summary of packages
// their relative sizes and total size
var bytes = require('bytes');

function percentage(size, total) {
  if(total == 0) return 100;
  return Math.floor(size / total * 100 );
}

function rpad(str, length) {
  if(str.toString().length >= length) return str;
  return str + new Array(length - str.toString().length).join(' ');
}

function compare(before, after) {
  return [
    ' (' + (after < before ? '' : '+ '),
    bytes(after - before), ' ',
    (percentage(after, before) - 100) + '%)'];
}

module.exports = function(list) {

  // calculate the totals - need this information to display percentage sizes of files
  var totalsByPackageIndex = [],
      total = 0,
      totalAfterByPackageIndex = [],
      totalAfter = 0;

  list.packages.forEach(function(pack, index) {
    totalsByPackageIndex[index] = pack.files.reduce(function(prev, item) {
      if(!totalAfterByPackageIndex[index]) {
        totalAfterByPackageIndex[index] = 0;
      }
      totalAfterByPackageIndex[index] += (item.sizeAfter || 0);
      return prev + item.stat.size;
    }, 0);
    total += totalsByPackageIndex[index];
    totalAfter += totalAfterByPackageIndex[index];
  });

  var rows = [];

  list.packages.forEach(function(pack, index) {
    rows.push('# ' + (pack.name ? pack.name : 'Root package'));

    pack.files.sort(function(a, b) {
      return b.stat.size - a.stat.size;
    });

    pack.files.forEach(function(item) {
      var row = ['  ', item.name, ' ', bytes(item.stat.size),
                 ' ',  percentage(item.stat.size, total), '%' ];
      if(item.sizeAfter) {
        row = row.concat([
          ' -> ', bytes(item.sizeAfter)],
          compare(item.stat.size, item.sizeAfter)
          );
      }
      rows.push(row);
    });

    var line = [
      'Package total: ', bytes(totalsByPackageIndex[index]),
      ' ', percentage(totalsByPackageIndex[index], total), '%'
    ];

    if(totalAfter > 0) {
      line = line.concat([ ' -> ', bytes(totalAfterByPackageIndex[index])],
        compare(totalsByPackageIndex[index], totalAfterByPackageIndex[index]));
    }
    rows.push(line.join(''));

    if(Object.keys(pack.dependenciesById).length > 0) {
      rows.push('Package dependencies: ' +Object.keys(pack.dependenciesById).join(', '));
    }
  });


  var colSizes = [];
  rows.forEach(function(row) {
    // ignore "log lines"
    if(!Array.isArray(row)) return;
    row.forEach(function(col, index) {
      colSizes[index] = Math.max(colSizes[index] || 0, col.toString().length + 1);
    });
  });

  rows.forEach(function(row) {
    if(!Array.isArray(row)) {
      console.log(row);
      return;
    }
    console.log(
      row.reduce(function(prev, curr, index) {
        return prev += rpad(curr, colSizes[index]);
      }, ''));
  });

  if(totalAfter > 0) {
    console.log('Total size: ' + bytes(totalAfter) + (totalAfter > 0 ? compare(total, totalAfter).join('') : ''));
  } else {
    console.log('Total size: ' + bytes(total));
  }

};
