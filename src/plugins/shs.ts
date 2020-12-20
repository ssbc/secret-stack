import * as u from '../util'
import { Config } from '../types'
const Shs = require('multiserver/plugins/shs')

function toBuffer (base64: string | Buffer): Buffer {
  if (Buffer.isBuffer(base64)) return base64
  const i = base64.indexOf('.')
  return Buffer.from(~i ? base64.substring(0, i) : base64, 'base64')
}

function toSodiumKeys (keys: NonNullable<Config['keys']>) {
  if (typeof keys.public !== 'string' || typeof keys.private !== 'string') {
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
  init (api: any, config: Config) {
    const keys = config.keys && toSodiumKeys(config.keys)    
    if (!keys) {
      console.error(new Error('Config object should contains SHS keys'))
    }

    let timeoutHandshake: number | undefined
    if (!isNaN(config.timers?.handshake as any)) {
      timeoutHandshake = config.timers?.handshake!
    }
    if (!timeoutHandshake) {
      timeoutHandshake = (config.timers ? 15e3 : 5e3)
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
      keys,
      seed: config.seed,
      appKey: toBuffer(shsCap),
      timeout: timeoutHandshake,
      authenticate: function (pub: string, cb: Function) {
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
}
