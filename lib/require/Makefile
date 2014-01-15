COMPRESS := ../../node_modules/.bin/uglifyjs

all: uglify
uglify:
	@echo "Require shim char count:"
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js 2> /dev/null | wc -c
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js 2> /dev/null | $(COMPRESS) --beautify 2> /dev/null > require.min.js
	@echo "UMD shim char count:"
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null | wc -c
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null | $(COMPRESS) --beautify 2> /dev/null > umd.min.js

build:
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js 2> /dev/null > require.min.js
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null > umd.min.js
	@ls -lah

.PHONY: uglify build
