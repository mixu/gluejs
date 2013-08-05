TESTS += test/*.test.js
TESTS += test/list-tasks/*.test.js

test:
	@mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test

style:
	jshint index.js lib bin --exclude "lib/runner/package-commonjs/resources/require*"
