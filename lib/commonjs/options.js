
{
  remap: {
    type: Object,
    default: {}
  },
  cache: {
    type: Boolean,
    default: true
  },
  'cache-path': {
    type: 'Path',
    default: function() {

    }
  },
  'cache-method': {
    type: String,
    default: 'stat'
  },
  include: {
    type: [ 'Path' ],
    default: []
  },
  exclude: {
    type: [ 'Path' ],
    default: []
  },
  ignore
