Contains the require shim and UMD shim.

## require.js

The require() shim is based on the stuff that visionmedia's require() shim, though with a bunch of additions to make it support nested packages and chained requires as well as to improve the minified footprint.

## umd.js

The UMD shim is via https://github.com/ForbesLindesay/umd.

I kind of wish I could use that, but it pulls in a lot of dependencies (stream wrappers) including running uglifyjs when called (rather than statically), and I can get a slightly smaller output by building the UMDification into the same IIFE.
