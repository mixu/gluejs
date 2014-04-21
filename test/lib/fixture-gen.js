var os = require('os'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf');

function FixtureGen() {
  this.root = this.filename({
    path: os.tmpDir()
  });
  fs.mkdirSync(this.root);
}

// get a new filename
FixtureGen.prototype.filename = function(opts) {
  var filename,
      basePath;
  if (opts && opts.path) {
    basePath = opts.path;
  } else {
    basePath = this.root;
  }
  // generate a new file name
  do {
    filename = basePath + '/' +
      Math.random().toString(36).substring(2) +
      (opts && opts.ext ? opts.ext : '');
  } while(fs.existsSync(filename));

  return filename;
};

FixtureGen.prototype.file = function(data, opts) {
  var filename = this.filename(opts);

  fs.writeFileSync(filename, (Array.isArray(data) ? data.join('\n') : data));

  return filename;
};

FixtureGen.prototype.dirname = function() {
  var filename = this.filename();
  fs.mkdirSync(filename);
  return filename;
};

FixtureGen.prototype.dir = function(spec) {
  // generate a new directory
  var outDir = this.filename();
  fs.mkdirSync(outDir);
  // create each file under the directory
  Object.keys(spec).forEach(function(name) {
    var data = spec[name];
    var fullname = path.normalize(outDir + '/' + name);

    if (path.dirname(fullname) != outDir) {
      mkdirp.sync(path.dirname(fullname));
    }
    fs.writeFileSync(fullname, (Array.isArray(data) ? data.join('\n') : data));
  });
  return outDir;
};

FixtureGen.prototype.clean = function() {
  // ensure that this is under os.tmpdir()
  if (this.root.substr(os.tmpDir().length) == os.tmpDir()) {
    rimraf.sync(this.root);
  }
};

module.exports = FixtureGen;
