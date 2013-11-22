TESTS += test/*.test.js
TESTS += test/list-tasks/*.test.js

test:
	@mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test lint

lint:
	jshint . \
	--exclude="**/node_modules" \
	--exclude="lib/runner/package-commonjs/resources" \
	--exclude="test/command-integration"
	gjslint \
	--nojsdoc \
	--jslint_error=all \
	--disable=6 \
	--max_line_length=120 \
	--exclude_directories=node_modules,lib/runner/package-commonjs/resources,test/command-integration -r .
