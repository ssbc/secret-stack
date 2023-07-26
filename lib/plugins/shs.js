const u = require('../util')
// @ts-ignore
const Shs = require('multiserver/plugins/shs')

/**
 * @typedef {import('../types').Config} Config
 */

/**
 * @param {string | Buffer} base64
 * @returns {Buffer}
 */
function toBuffer (base64) {
  if (Buffer.isBuffer(base64)) return base64
  const i = base64.indexOf('.')
  return Buffer.from(~i ? base64.substring(0, i) : base64, 'base64')
}

/**
 *
 * @param {NonNullable<Config['keys']>} keys
 * @returns
 */
function toSodiumKeys (keys) {
  if (typeof keys.public !== 'string' || typeof keys.private !== 'string') {
    return keys
  }
  return {
    publicKey: toBuffer(keys.public),
    secretKey: toBuffer(keys.private)
  }
}

module.exports = {
  name: 'multiserver-shs',
  version: '1.0.0',

  /**
   * @param {any} api
   * @param {Config} config
   */
  init (api, config) {
    /** @type {number | undefined} */
    let timeoutHandshake
    if (u.isNumber(config.timers?.handshake)) {
      timeoutHandshake = config.timers?.handshake
    }
    if (!timeoutHandshake) {
      timeoutHandshake = config.timers ? 15e3 : 5e3
    }
    // set all timeouts to one setting, needed in the tests.
    if (config.timeout) {
      timeoutHandshake = config.timeout
    }

    const shsCap = (config.caps && config.caps.shs) ?? config.appKey
    if (!shsCap) {
      throw new Error('secret-stack/plugins/shs must have caps.shs configured')
    }

    const shs = Shs({
      keys: config.keys && toSodiumKeys(config.keys),
      seed: config.seed,
      appKey: toBuffer(shsCap),
      timeout: timeoutHandshake,

      /**
       * @param {string} pub
       * @param {Function} cb
       */
      authenticate (pub, cb) {
        const id = '@' + u.toId(pub)
        api.auth(id, (/** @type {any} */ err, /** @type {any} */ auth) => {
          if (err) cb(err)
          else cb(null, auth ?? true)
        })
      }
    })

    /**
     * @param {Buffer} publicKey
     */
    function identify (publicKey) {
      const pubkey = publicKey.toString('base64')
      return {
        get pubkey () {
          return pubkey
        }
      }
    }

    const id = '@' + u.toId(shs.publicKey)
    api.id = id // Legacy ID
    api.publicKey = id
    // Modern ID
    const identified = identify(shs.publicKey)
    Object.defineProperty(api, 'shs', {
      get () {
        return identified
      }
    })

    api.multiserver.transform({
      name: 'shs',
      create: () => shs,
      identify
    })
  }
}
