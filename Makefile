TESTS += test/glue.test.js
TESTS += test/group.test.js

test:
	@mocha \
		--ui exports \
		--reporter list \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test
