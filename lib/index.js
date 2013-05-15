module.exports = require('./glue.js');

module.exports.defaults({ 'reqpath': require('path').dirname(require.cache[__filename].parent.filename) });
