const Api = require('./api')

/**
 * @param {unknown} config
 */
module.exports = function SecretStack (config) {
  const create = Api([], config ?? {})

  return (
    create
      .use(require('./core'))
      // default network plugins
      .use(require('./plugins/net'))
      .use(require('./plugins/shs'))
  )
}
