module.exports = {
  a: require('./models/a.js'),
  b: require('./models/b.js'),
  init: init
};

function init() {
  console.log(require('model').a);
  console.log(require('model').b);
}
