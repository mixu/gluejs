all: uglify
uglify:
	uglifyjs --no-copyright ./require.js \
	| tee /dev/tty | wc -c

gzip:
	uglifyjs --no-copyright ./require.js \
	| gzip | wc -c

build:
	uglifyjs --no-copyright ./require.js > require.min.js
	uglifyjs --no-copyright ./require.nothrow.js > require.nothrow.min.js

.PHONY: uglify gzip

