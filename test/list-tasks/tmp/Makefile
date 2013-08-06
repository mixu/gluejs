build:
	../../../bin/gluejs \
		--include ./index.js \
		--include ./node_modules \
		--exclude /tests/ \
		--include lib \
		--global foo \
		--main index.js \
		--out foo.js \
		--remap "assert=require('chai').assert" \
		--remap "abc=require('./lib/bar')" \
		--global-require
