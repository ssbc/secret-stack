import Api = require('./api')

// config must have appKey
export = function SecretStack (config: any) {
  // this weird thing were some config is loaded first,
  // then the rest later... not necessary.
  config = config || {}
  config.permissions = config.permissions || {}

  var plugin = {
    permissions: config.permissions,
    init: function () {}
  }

  var create = Api(
    [plugin], // weird that this passes a mostly empty plugin in here?
    config
  )

  return (
    create
      .use(require('./core'))
      // default network plugins
      .use(require('./plugins/net'))
      .use(require('./plugins/shs'))
  )
}
