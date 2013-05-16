module.exports = function(tree, options) {
  var expression = options.expression,
      tasks = options.tasks;

  tree.files.forEach(function(file) {
    if(expression.test(file)) {
      file.tasks = (file.tasks ? file.tasks : []).concat(tasks);
    }
  })
};

