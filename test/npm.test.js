var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    Glue = require('../lib/glue.js');

// need to be able to render a package, and
// then have that package be included inside another build (recursively)

// each package needs to have its own set of modules = { 'relpath / name': wrapped() }

// requires need to be scoped correctly

exports['calling npm(name, sourcePath) creates a new filegroup and renders it'] = function(done) {

};

exports['calling npm(pathToPackageJson) create a new filegroup and renders it'] = function(done) {

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('../node_modules/.bin/mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
