'use strict'
var u          = require('./util')
var Api        = require('./api')

//opts must have appKey
module.exports = function (config_defaults) {
  //this weird thing were some config is loaded first, then the rest later... not necessary.
  config_defaults = config_defaults || {}
  config_defaults.permissions = config_defaults.permissions || {}
  var create = Api(
    //weird that this passes a mostly empty plugin in here?
    config_defaults.permissions ? [{
    permissions: config_defaults.permissions,
    init: function () {}
  }]: null, config_defaults)

  return create
    .use(require('./core'))
    //default network plugins
    .use(require('./plugins/net'))
    .use(require('./plugins/shs'))
}

