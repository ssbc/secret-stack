const Api = require('./api')

/**
 * @param {unknown} config
 */
module.exports = function SecretStack (config) {
  const create = Api([], config ?? {})

  return create.use(require('./core'))
}
