import Api = require('./api')

// config must have appKey
export = function SecretStack (config: any) {
  // this weird thing were some config is loaded first,
  // then the rest later... not necessary.
  config = config ?? {}
  config.permissions = config.permissions ?? {}

  const plugin = {
    permissions: config.permissions,
    init: function () {}
  }

  // weird that this passes a mostly empty plugin in here?
  const create = Api([plugin], config)

  return (
    create
      .use(require('./core'))
      // default network plugins
      .use(require('./plugins/net'))
      .use(require('./plugins/shs'))
  )
}
