var u  = require('../util')
var Shs = require('multiserver/plugins/shs')

exports.name = 'multiserver-shs'
exports.version = '1.0.0'
exports.mainfest = {}

function isFunction (f) { return 'function' === typeof f }
function isString (s) { return 'string' === typeof s }
function isObject (o) { return o && 'object' === typeof o && !Array.isArray(o) }

function toBuffer(base64) {
  if(Buffer.isBuffer(base64)) return base64
  var i = base64.indexOf('.')
  return new Buffer(~i ? base64.substring(0, i) : base64, 'base64')
}

function toSodiumKeys (keys) {
  if(!(isString(keys.public) && isString(keys.private)))
    return keys
  return {
    publicKey: toBuffer(keys.public),
    secretKey: toBuffer(keys.private)
  }
}

exports.init = function (api, config, permissions) {
  var opts = config
  var timeout_handshake
  if(opts.timers && !isNaN(opts.timers.handshake))
    timeout_handshake = opts.timers.handshake

  timeout_handshake = timeout_handshake || (opts.timers ? 15e3 : 5e3)

  //set all timeouts to one setting, needed in the tests.
  if(opts.timeout)
    timeout_handshake = timeout_inactivity = opts.timeout

  var shsCap = (config.caps && config.caps.shs) || config.appKey
  if(!shsCap) throw new Error('secret-stack/plugins/shs must have caps.shs configured')

  var shs = Shs({
    keys: config.keys && toSodiumKeys(config.keys),
    seed: config.seed,
    appKey: toBuffer(shsCap),

    //****************************************
    timeout: timeout_handshake,

    authenticate: function (pub, cb) {
      var id = '@'+u.toId(pub)
      api.auth(id, function (err, auth) {
        if(err) cb(err)
        else    cb(null, auth || true)
      })
    }
  })

  var id = '@'+u.toId(shs.publicKey)
  api.id = id
  api.publicKey = id

  api.multiserver.transform({
    name: 'shs',
    create: function () {
      return shs
    }
  })
}









