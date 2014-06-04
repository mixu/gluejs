var fs = require('fs'),
    path = require('path'),
    bytes = require('bytes'),
    style = require('./style.js');

// takes a list.packages object and produces a summary of packages
// their relative sizes and total size

function percentage(size, total) {
  if (total === 0) return 100;
  return Math.floor(size / total * 100);
}

function rpad(str, length) {
  if (str.toString().length >= length) return str;
  return str + new Array(length - str.toString().length).join(' ');
}

function compare(before, after) {
  if (after < before) {
    return [
      style(' (' + bytes(after - before), 'green'), ' ',
      style((percentage(after, before) - 100) + '%)', 'green')];
  } else if (after - before < 200) {
    return [
      style(' (' + bytes(after - before), 'yellow'), ' ',
      style((percentage(after, before) - 100) + '%)', 'yellow')];
  }
  return [
    style(' (+ ' + bytes(after - before), 'red'), ' ',
    style((percentage(after, before) - 100) + '%)', 'red')];
}

module.exports = function(emitter) {

  var statBefore = {},
      statAfter = {};

  emitter.on('file', function(file) {
    statBefore[file] = fs.statSync(file);
  });

  emitter.on('file-done', function(file, resultFile) {
    statAfter[file] = fs.statSync(resultFile);
  });

  emitter.once('done', function() {
    process.nextTick(function() {
      // calculate the totals - need this information to display percentage sizes of files
      var cwd = process.cwd(),
          total = 0,
          totalAfter = 0;

      Object.keys(statBefore).forEach(function(file) {
        total += statBefore[file].size;
      });
      Object.keys(statAfter).forEach(function(file) {
        totalAfter += statAfter[file].size;
      });

      var rows = [];

      var files = Object.keys(statAfter).sort(function(a, b) {
        return statAfter[b].size - statAfter[a].size;
      });

      files.forEach(function(file) {
        var relpath = path.relative(cwd, file);
        var row = ['  ', style(path.dirname(relpath) + '/', 'gray') +
        path.basename(relpath), ' ', bytes(statBefore[file].size),
                   ' ', percentage(statBefore[file].size, total), '%'];
        if (statAfter[file] && statBefore[file].size != statAfter[file].size) {
          row = row.concat([
            ' -> ', bytes(statAfter[file].size)],
            compare(statBefore[file].size, statAfter[file].size)
            );
        }
        rows.push(row);
      });

      var colSizes = [];
      rows.forEach(function(row) {
        // ignore "log lines"
        if (!Array.isArray(row)) return;
        row.forEach(function(col, index) {
          colSizes[index] = Math.max(colSizes[index] || 0, col.toString().length + 1);
        });
      });

      rows.forEach(function(row) {
        if (!Array.isArray(row)) {
          process.stderr.write(row + '\n');
          return;
        }
        process.stderr.write(
          row.reduce(function(prev, curr, index) {
            return prev += rpad(curr, colSizes[index]);
          }, '') + '\n');
      });

      if (totalAfter > 0) {
        process.stderr.write('Total size: ' + bytes(totalAfter) +
          (totalAfter > 0 ? compare(total, totalAfter).join('') : '') + '\n');
      } else {
        process.stderr.write('Total size: ' + bytes(total) + '\n');
      }
    });
  });
};
