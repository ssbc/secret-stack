import * as u from '../util'
const Shs = require('multiserver/plugins/shs')

function toBuffer (base64: string | Buffer): Buffer {
  if (Buffer.isBuffer(base64)) return base64
  const i = base64.indexOf('.')
  return Buffer.from(~i ? base64.substring(0, i) : base64, 'base64')
}

function toSodiumKeys (keys: any) {
  if (!(typeof keys.public === 'string' && typeof keys.private === 'string')) {
    return keys
  }
  return {
    publicKey: toBuffer(keys.public),
    secretKey: toBuffer(keys.private)
  }
}

export = {
  name: 'multiserver-shs',
  version: '1.0.0',
  mainfest: {},
  init (api: any, config: any) {
    let timeoutHandshake: number
    if (config.timers && !isNaN(config.timers.handshake)) {
      timeoutHandshake = config.timers.handshake
    }
    timeoutHandshake = timeoutHandshake! || (config.timers ? 15e3 : 5e3)
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
      authenticate: function (pub: any, cb: Function) {
        const id = '@' + u.toId(pub)
        api.auth(id, function (err: any, auth: any) {
          if (err) cb(err)
          else cb(null, auth || true)
        })
      }
    })

    const id = '@' + u.toId(shs.publicKey)
    api.id = id
    api.publicKey = id

    api.multiserver.transform({
      name: 'shs',
      create: () => shs
    })
  }
};
