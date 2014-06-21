#!/usr/bin/env node
var fs = require('fs'),
    Minilog = require('minilog'),
    Packer = require('../lib/runner/amd2/api.js');

var yargs = require('yargs')
    .usage('Usage: $0 --include <file/dir ...>')
    .options({
      'amd': { },
      'cache': { default: true },
      'include': { },
      'main': { },
      'log': { default: 'warn' }
    })
    .boolean('amd'),
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

var p = new Packer();

p.set(argv);

// -- out
if(argv['out']) {
  p.render(fs.createWriteStream(argv['out']));
} else {
  p.render(process.stdout);
}
