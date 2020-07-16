import Api = require('./api')

// config must have appKey
export = function SecretStack (config: unknown) {
  const create = Api([], config ?? {})

  return (
    create
      .use(require('./core'))
      // default network plugins
      .use(require('./plugins/net'))
      .use(require('./plugins/shs'))
  )
}
