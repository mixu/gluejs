all: brfs coffee hbsfy es6 jade

brfs:
	@printf "\n\n"
	@printf "**** brfs ****\n"
	@printf "\n"
	../../bin/gluejs --transform brfs --include ./test.brfs.js

coffee:
	@printf "\n\n"
	@printf "**** coffee ****\n"
	@printf "\n"
	../../bin/gluejs --transform coffeeify --include ./test.coffee

hbsfy:
	@printf "\n\n"
	@printf "**** hbsfy ****\n"
	@printf "\n"
	../../bin/gluejs --transform hbsfy --include ./test.hbs

es6:
	@printf "\n\n"
	@printf "**** es6 ****\n"
	@printf "\n"
	../../bin/gluejs --transform ./es6-module.js --include ./test.es6.js

jade:
	@printf "\n\n"
	@printf "**** jade ****\n"
	@printf "\n"
	../../bin/gluejs --transform ./jade-module.js --include ./test.jade
