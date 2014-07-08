#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    Minilog = require('minilog'),
    Packer = require('../lib/amd/api.js');

var yargs = require('yargs')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'cache-method': { },
      'cache-path': { },
      'command': { },
      'config': { },
      'include': { },
      'list-files': { },
      'log': { default: 'warn' },
      'main': { },
      'out': { },
      'vendor': { },
      'vendor-base': { }
    })
    .boolean('amd')
    .boolean('cache')
    .boolean('ls-config'),
    argv = yargs.parse(process.argv);

if (!argv['include']) {
  console.log('Usage: --include <file/dir>');
  console.log('Options:');
  console.log('  --amd');
  console.log('  --config');
  console.log('  --vendor');
  console.log('  --main <file>');
  process.exit(1);
}

Minilog.enable();

if (argv['cache-path']) {
  argv['cache-path'] = path.resolve(process.cwd(), argv['cache-path']);
}

if (argv['ls-config']) {
  var sorted = {};
  Object.keys(argv).sort().forEach(function(key) {
    sorted[key] = argv[key];
  });
  if (argv['ls-config']) {
    console.error('\nOptions:');
    Object.keys(sorted).forEach(function(key) {
      console.error('  --' + key + ' ' + require('util').inspect(sorted[key], null, 20, process.stderr.isTTY));
    });
  }
}

var p = new Packer();

p.set(argv);

// -- out
if (argv['out']) {
  p.render(fs.createWriteStream(argv['out']));
} else {
  p.render(process.stdout);
}
