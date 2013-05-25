# gluejs

Build CommonJS modules for the browser via a chainable API.

## Changes from v1

- switched to using streams for file processing, which makes integrating 3rd party rules easier
- switched from specialized objects to a file tree, which makes filtering and implmenting more sophisticated operations easier since they can be decomposed into smaller tasks that operate on a common structure.

## Options

- .set('silent', false): enable verbose logging
- .set('sourceurl', true): enable source urls
- .set('global-require', true): overwrite / export the require implementation from the package, allowing you to call require() from outside the package as if you were inside the package.
