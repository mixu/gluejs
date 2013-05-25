var fs = require('fs');

// This task adds a .stat property to every file in the list
module.exports = function(list) {
  list.files.forEach(function(obj, i) {
    list.files[i].stat = fs.statSync(obj.name);
  });
};
