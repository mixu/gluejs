module.exports = function(list, options) {
  var expression = options.expression,
      tasks = options.tasks;

  list.files.forEach(function(file) {
    if(expression.test(file)) {
      file.tasks = (file.tasks ? file.tasks : []).concat(tasks);
    }
  })
};

