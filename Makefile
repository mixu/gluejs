TESTS += ./require.test.js
TESTS += ./unit/transforms/*.test.js
TESTS += ./integration/*.test.js

test:
	@cd test && mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)
	@echo "Note: you need to go run npm install in ./test to install the test dependencies..."

.PHONY: test lint


GJSLINT := --nojsdoc --exclude_directories=node_modules,lib/require,test,temp --max_line_length=120 --disable=200,201,202,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,230,231,232,233,250,251,252

lint:
	fixjsstyle $(GJSLINT) -r .
	gjslint $(GJSLINT) -r .
	jshint .

.PHONY: lint

test-lint:
	./bin/gluejs \
		--no-cache \
		--include ./lib \
		--basepath ./ \
		--out /tmp/lint.js
	gjslint --nojsdoc --custom_jsdoc_tags=api --max_line_length=120 --disable=0131,300,2,1,6 /tmp/lint.js

docs:
	generate-md --input ./readme.md --output temp/

