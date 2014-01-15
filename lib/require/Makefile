COMPRESS := ../../node_modules/.bin/uglifyjs

all: uglify
uglify:
	@echo "Char count:"
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js | wc -c
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js | $(COMPRESS) --beautify > require.min.js

build:
	@$(COMPRESS) --compress --mangle sort,toplevel ./require.js > require.min.js

.PHONY: uglify build
