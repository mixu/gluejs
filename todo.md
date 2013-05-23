# Todo

- pre-filters for .git / svn / hg / cvs directories for better performance
- attach the stat information during the tree traversal to avoid double stats
- better metadata fetching from package.json
  - it should be possible to pre-filter the packages (before infer packages),
    so that devDependencies are not included in the processing
  - version numbers should be fetched
- ability to remap paths
  - e.g. add a file to the root from outside the root, with a different virtual filename
  - e.g. swap out the content a directory for the content of another one (shimming)
- better logging (e.g. during filtering)
- better reporting (e.g. post-build summary)


# Internals

Phases:

- acquire file paths (e.g. via calls to .include and .npm)
    => result is a tree { files: [] } (under basepath)
    => note that nothing is excluded here
- filter file paths (e.g. remove excluded, remove .npmignore and so on)
- attach tasks
- run tasks
- squash result (or save to a directory)

Pre-task:

- acquire => e.g. convert inputs to a tree of files
- read

File tasks:

- run-shell (e.g. run uglify)
- wrap-commonjs-web (e.g. wrap inside a function call)
- wrap-commonjs-web-sourceurl
- wrap-commonjs-amd (e.g. take commonJS files, resolve their direct dependencies, wrap into an AMD module)
- wrap-amd-commonjs-web (e.g. take a AMD file, look at the dependency declaration, convert that to a string, wrap into a web-commonjs module)

Tree tasks:

- annotate-basepath
- annotate-stat
- annotate-structured
- annotate-with-task
- annotate-main-file

- filter-regex
- filter-npm
- filter-packages


Final tasks:

- concatenate
- static-server (e.g. serve over http)
- package-commonjs (to any writable stream)
