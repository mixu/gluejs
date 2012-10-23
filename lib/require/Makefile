all: uglify
uglify:
	uglifyjs --no-copyright ./require.new.unoptimized.js \
	| tee /dev/tty | wc -c

gzip:
	uglifyjs --no-copyright ./require.new.unoptimized.js \
	| gzip | wc -c

build:
	uglifyjs --no-copyright ./require.new.unoptimized.js > require.new.min.js
	uglifyjs --no-copyright ./require.new.unoptimized.js | uglifyjs --beautify > require.new.js

.PHONY: uglify gzip

