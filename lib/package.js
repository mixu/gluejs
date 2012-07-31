var fs = require('fs'),
    path = require('path'),
    resolver = require('package-json-resolver');

function series(callbacks, last) {
  function next() {
    var callback = callbacks.shift();
    if(callback) {
      callback(next);
    } else {
      last();
    }
  }
  next();
}

var globalHandlers = [
  {
    // take all the .js files and concatenate them
    re: new RegExp('.*\.js$'),
    handler: function(opts, done) {
      return done(opts.filename, fs.readFileSync(opts.filename, 'utf8'));
    }
  }
];

function Package() {
  this.name = '';
  this.main = '';
  this.basepath = '';
  this.files = [];
  this.children = [];
  this.handlers = [];
};

Package.prototype.dependency = function(name, contextPath) {
  var self = this;
  if(arguments.length == 1 || typeof contextPath == 'undefined') {
    // npm package
    var fullPath = name,
        packageContent = require(fullPath);
    if(!packageContent || !packageContent.dependencies || !Array.isArray(Object.keys(packageContent))) {
      throw new Error('Could not read package.json key "dependencies" from '+ fullPath);
    }
    Object.keys(packageContent.dependencies).forEach(function(depname) {
      self.dependency(depname, path.dirname(fullPath));
    });
  } else {
    var child = new Package(),
        resolvePath = resolver.resolve(contextPath, name);
    if(resolvePath == '') {
      throw new Error('Could not resolve '+name+' from '+contextPath);
    }
    resolver.expand(resolvePath, function(basePath, main, files, dependencies) {
      child.name = name;
      child.files = files;
      child.main = main.replace(new RegExp('^'+basePath), '');
      child.basepath = basePath;
      dependencies.forEach(function(dep) {
        child.dependency(dep, basePath);
      });

      self.children.push(child);
    });
  }
  return this;
};

Package.prototype._runHandlers = function(selfId, onDone) {
  var self = this;
  function relative(filename){
    return filename.replace(new RegExp('^'+self.basepath), '');
  }
  var opts = { relative: relative },
      result = {},
      tasks = [];

  // create tasks for each file
  // We will only allow one handler to match each file, since this makes things less confusing

  var handlers = [].concat(globalHandlers, this.handlers);

  this.files.forEach(function(filename) {
    var matching = handlers.filter(function(handler) {
      return handler.re.test(filename);
    });
    if(matching.length == 0) {
      console.log('Warn: ', filename, 'not handled');
      return;
    } else if(matching.length > 1) {
      console.log('Warn: ', filename, 'matches multiple handlers');
      return;
    }
    tasks.push( function(done) {
      opts.filename = filename;
      opts.relativeFilename = opts.relative(filename);
      matching[0].handler(opts, function(filename, source) {
        var relpath = relative(filename),
            opt = {};
        result[relpath] = 'function(module, exports, require){' +
           (opt.debug? 'eval(' + JSON.stringify(source + '\n\/\/@ sourceURL=/'+self.name+'/'+relpath)+');' : source) +
           '}';
        done();
      });
    });
  });

  // serial execution for tasks
  series(tasks, function() { onDone(result); });
};


Package.prototype.render = function(result, onDone) {
  var self = this,
      selfId = result.length,
      tasks = [];
  this._runHandlers(selfId, function(fileObj) {
    // store the result of building our own files
    result[selfId] = fileObj;
    // render each child
    self.children.forEach(function(child) {
      tasks.push(function(done) {
        child.render(result, function(childId) {
          // for each child, add a reference
          result[selfId][child.name] = JSON.stringify({ context: childId, main: child.main });
          done();
        });
      });
    });

    series(tasks, function() {
      onDone(selfId);
    });
  });

};

module.exports = Package;
