module.exports = function(emitter) {

  var progress = { total: 0, complete: 0, hit: 0, miss: 0 };

  if (!process.stderr.isTTY) {
    return;
  }

  var start,
      width = 20,
      fmt = '[:bar] :current / :total :percent :etas (cache hits: :hits)';

  function status() {
    var ratio = progress.complete / progress.total;
    ratio = Math.min(Math.max(ratio, 0), 1);

    var percent = ratio * 100,
        complete = Math.round(width * ratio),
        incomplete,
        elapsed = new Date - start,
        eta = (percent == 100) ? 0 : elapsed * (progress.total / progress.complete - 1);

    complete = Array(complete).join('=');
    incomplete = Array(width - complete.length).join(' ');

    return fmt
            .replace(':bar', complete + incomplete)
            .replace(':current', progress.complete)
            .replace(':total', progress.total)
            .replace(':elapsed', isNaN(elapsed) ? "0.0" : (elapsed / 1000).toFixed(1))
            .replace(':eta', (isNaN(eta) || !isFinite(eta)) ? "0.0" : (eta / 1000).toFixed(1))
            .replace(':percent', percent.toFixed(0) + '%')
            .replace(':hits', progress.hit);
  }


  emitter.on('file', function(file) {
    progress.total += 1;
    if (progress.total === 1) {
      start = new Date();
      process.stderr.write(' ');
    }
  });

  emitter.on('hit', function(file) {
    progress.hit++;
    progress.complete++;

    process.stderr.clearLine();
    process.stderr.cursorTo(0);
    process.stderr.write(status());
  });

  emitter.on('miss', function(file) {
    progress.complete++;
    process.stderr.clearLine();
    process.stderr.cursorTo(0);
    process.stderr.write(status());
  });

  emitter.once('done', function() {
    process.stderr.clearLine();
    process.stderr.cursorTo(0);
    process.stderr.write(status() + '\n');
  });
};
