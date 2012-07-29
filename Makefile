TESTS += test/glue.test.js
TESTS += test/group.test.js
TESTS += test/require.test.js
TESTS += test/package.test.js

test:
	@mocha \
		--ui exports \
		--reporter list \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test
