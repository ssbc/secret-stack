import * as u from '../util'
var Shs = require('multiserver/plugins/shs')

function isString (s: any): s is string {
  return typeof s === 'string'
}

function toBuffer (base64: string | Buffer): Buffer {
  if (Buffer.isBuffer(base64)) return base64
  var i = base64.indexOf('.')
  return Buffer.from(~i ? base64.substring(0, i) : base64, 'base64')
}

function toSodiumKeys (keys: any) {
  if (!(isString(keys.public) && isString(keys.private))) {
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
  init: function (api: any, config: any) {
    var timeoutHandshake: number
    if (config.timers && !isNaN(config.timers.handshake)) {
      timeoutHandshake = config.timers.handshake
    }
    timeoutHandshake = timeoutHandshake! || (config.timers ? 15e3 : 5e3)
    // set all timeouts to one setting, needed in the tests.
    if (config.timeout) {
      timeoutHandshake = config.timeout
    }

    var shsCap = (config.caps && config.caps.shs) || config.appKey
    if (!shsCap) {
      throw new Error('secret-stack/plugins/shs must have caps.shs configured')
    }

    var shs = Shs({
      keys: config.keys && toSodiumKeys(config.keys),
      seed: config.seed,
      appKey: toBuffer(shsCap),
      timeout: timeoutHandshake,
      authenticate: function (pub: any, cb: Function) {
        var id = '@' + u.toId(pub)
        api.auth(id, function (err: any, auth: any) {
          if (err) cb(err)
          else cb(null, auth || true)
        })
      }
    })

    var id = '@' + u.toId(shs.publicKey)
    api.id = id
    api.publicKey = id

    api.multiserver.transform({
      name: 'shs',
      create: function () {
        return shs
      }
    })
  }
};
