var fs = require('fs'),
    path = require('path');

var umd = require('umd');

// package wrapper
var Transform = require('readable-stream').Transform;

function WrapCJS(options) {
  Transform.call(this, options);
  this.opts = options || {};
  this.first = true;
}

WrapCJS.prototype = Object.create(Transform.prototype, { constructor: { value: WrapCJS }});

WrapCJS.prototype.writePrelude = function() {
  if (!this.first) {
    return;
  }
  if (this.opts.standalone) {
      return this.push(umd.prelude(this.opts.standalone).trim() + 'return ');
  }
  if (hasExports) {
    return this.push((this.opts.externalRequireName || 'require') + '=');
  }
};

WrapCJS.prototype._transform = function(chunk, encoding, done) {
  if (this.first) {
    this.writePrelude();
  }
  this.first = false;
  this.push(chunk);
  done();
};

WrapCJS.prototype._flush = function(done) {
  if (this.first) {
    this.writePrelude();
  }
  if (this.opts.standalone) {
      this.push(
          '\n(' + JSON.stringify(this.opts.mainModule) + ')' + umd.postlude(this.opts.standalone)
      );
  }

  if (this.opts.debug) {
    this.push('\n');
  }
  done();
};

module.exports = function(opts, onDone) {
  var files = opts.files,
      out = opts.out,
      main = opts.main,
      basepath = opts.basepath;

  var deps = [];

  var id = 1;
  var idLookup = {};

  // use int ids (drawback: can't require() paths)
  /*
  files.forEach(function(file, i) {
    if (!idLookup[file.filename]) {
      idLookup[file.filename] = id++;
    }
  });
  */
  // use relative paths as ids (limitation: can't do flexible lookups, only exact match)
  files.forEach(function(file) {
    if (!idLookup[file.filename]) {
      idLookup[file.filename] = './' + path.relative(basepath, file.filename);
    }
  });

  // store remapped references
  if(opts.remap) {
    Object.keys(opts.remap).forEach(function(name) {
      deps.push({
        id: name,
        source: 'module.exports = ' + opts.remap[name] + ';',
        nomap: true
      });
    });
  }
  // expose the base filename
  // TODO: make this less verbose
  files.forEach(function(file) {
    var dirname = './' + path.relative(basepath, path.dirname(file.filename)),
        extname = path.extname(file.filename),
        basename = path.basename(file.filename, extname);

    if (dirname.charAt(dirname.length - 1) != '/') {
      dirname += '/';
    }

    var variations = [
      dirname + basename,
      dirname + basename + extname,
    ];

    if (basename == 'index') {
      variations.push(dirname);
      variations.push(dirname.substr(0, dirname.length - 1));
    }

    variations.forEach(function(name) {
      if (idLookup[name]) {
        return;
      }
      deps.push({
          id: name,
          deps: {},
          source: 'module.exports=require(\''
              + idLookup[file.filename] + '\');',
          nomap: true
      });
    });
  });

  // set the main module
  var orig = path.normalize(basepath + '/' + main),
      reg = path.normalize(basepath + '/' + main + '.js'),
      packageRootId = idLookup[orig] || idLookup[reg];

  if (typeof packageRootId === 'undefined') {
    console.log('FILES', files);
    console.log('MAIN', main, basepath);
    throw new Error('You need to set the package root file explicitly, ' +
      'e.g.: `.main(\'index.js\')` or `--main index.js`. This is the file that\'s exported ' +
      'as the root of the package.');
  }

  files.forEach(function(file, i) {
    // documented options:
    // - id: can be numeric
    // - source: full source
    // - deps: hash from rawDep to id
    // - entry: true if entry
    // - order: order of entry points
    // undocumented options:
    // - sourceFile: looks like the original file name -- used for source map
    // - nomap: boolean, disables source map for a file -- seems to be set by the dedupe logic
    // in browserify

    // TODO:
    // set the mainmodule correctly
    // set the standalone name correctly (UMD exports name also enables UMD)
    var dhash = {};

    var i;
    for (i = 0; i < file.rawDeps.length; i++) {
      // convert deps hash to ids
      dhash[file.rawDeps[i]] = idLookup[file.deps[i]];
    }

    deps.push({
      id: idLookup[file.filename],
      source:
      (path.extname(file.filename) == '.json' ? 'module.exports = ' : '') +
        fs.readFileSync(file.content).toString(),
      deps: dhash
      // sourceFile: file.filename
    });
    if (idLookup[file.filename] == packageRootId) {
      deps[deps.length - 1].entry = true;
    }
  });

  // console.log(deps);
  // console.log(deps.map(function(dep) {
  //   var t = JSON.parse(JSON.stringify(dep));
  //   delete t.source;
  //   return t;
  // }));

  var pack = require('browser-pack');

  var stream = pack({ raw: true, sourceMapPrefix: '//#' });

//  stream.pipe(out);
  stream.pipe(new WrapCJS({
    standalone: 'foo',
    mainModule: packageRootId
  })).pipe(out);

  deps.forEach(function(dep) {
    stream.write(dep);
  });

  stream.end();

};
