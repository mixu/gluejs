COMPRESS := ../../node_modules/.bin/uglifyjs

all: uglify
uglify:
	@echo "Require shim char count:"
	@$(COMPRESS) --compress --mangle sort ./require.js 2> /dev/null | wc -c
	@$(COMPRESS) --compress --mangle sort ./require.js 2> /dev/null | $(COMPRESS) --beautify 2> /dev/null > require.min.js
	@echo "UMD shim char count:"
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null | wc -c
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null | $(COMPRESS) --beautify 2> /dev/null > umd.min.js

build:
	@$(COMPRESS) --compress --mangle sort ./require.js 2> /dev/null > require.min.js
	@$(COMPRESS) --compress --mangle sort ./umd.js 2> /dev/null > umd.min.js
	@ls -lah

debug:
	cp -v ./require.js require.min.js
	cp -v ./umd.js umd.min.js

.PHONY: uglify build
