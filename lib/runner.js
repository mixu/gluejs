module.exports = function(input, tasks, done) {

  tasks.forEach(function(task) {
    var current = task;
    // item is either a object (e.g. process) with .stdout/.stdin
    // or a function that returns an object
    if(typeof current == 'function') {
      current = task();
    }
    input.stdout.pipe(current.stdin);
    // if there is a stderr, pipe that - this avoids issues where the task fails to stderr
    // and the stdout is not flushed due to buffering
    if(current.stderr) {
      current.stderr.pipe(process.stderr);
    }

    input = current;
  });

  // return the last item (so that the caller can bind
  // e.g. to input.stdout.on("end") or pipe to process.stdout
  // Piping to process.stdout has to be handled a bit differently since it
  // will not emit "end" if part of the pipeline (and should not, since multiple things can pipe to it)
  return input;
};
