all: uglify
uglify:
	uglifyjs --no-copyright ./require.new.unoptimized.js \
	| tee /dev/tty | wc -c

gzip:
	uglifyjs --no-copyright ./require.new.unoptimized.js \
	| gzip | wc -c

.PHONY: uglify gzip

