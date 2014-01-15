TESTS += test/*.test.js
TESTS += test/list-tasks/*.test.js

test:
	@mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)
	@echo "Note: you need to go run npm install in ./test to install the test dependencies..."

.PHONY: test lint

# Note: use latest gjslint e.g 2.3.13
lint:
	jshint .
	gjslint \
	--nojsdoc \
	--jslint_error=all \
	--disable=6 \
	--max_line_length=120 \
	--custom_jsdoc_tags=api \
	--exclude_directories=node_modules,lib/runner/package-commonjs/resources,test \
	--max_line_length=120 --disable=0131,300,2,1,6 \
	-r .

test-lint:
	./bin/gluejs \
		--no-cache \
		--include ./lib \
		--basepath ./ \
		--out ./test/tmp/lint.js
	gjslint --nojsdoc --custom_jsdoc_tags=api --max_line_length=120 --disable=0131,300,2,1,6 ./test/tmp/lint.js
