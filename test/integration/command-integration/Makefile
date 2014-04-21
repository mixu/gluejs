all: brfs coffee hbsfy es6 jade

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
