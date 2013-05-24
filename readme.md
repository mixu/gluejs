# gluejs

Build CommonJS modules for the browser via a chainable API.

## Changes from v1

- switched to using streams for file processing, which makes integrating 3rd party rules easier
- switched from specialized objects to a file tree, which makes filtering and implmenting more sophisticated operations easier since they can be decomposed into smaller tasks that operate on a common structure.
