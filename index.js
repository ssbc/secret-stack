var u          = require('./util')
var Api        = require('./api')
var Muxrpc     = require('muxrpc')
var pull       = require('pull-stream')

var MultiServer = require('multiserver')
var WS          = require('multiserver/plugins/ws')
var Net         = require('multiserver/plugins/net')
var Onion       = require('multiserver/plugins/onion')
var Shs         = require('multiserver/plugins/shs')

var nonPrivate = require('non-private-ip')
var Inactive   = require('pull-inactivity')

function isFunction (f) { return 'function' === typeof f }
function isString (s) { return 'string' === typeof s }
function isObject (o) { return o && 'object' === typeof o && !Array.isArray(o) }

function toBase64 (s) {
  if(isString(s)) return s
  else s.toString('base64') //assume a buffer
}

function each(obj, iter) {
  if(Array.isArray(obj)) return obj.forEach(iter)
  for(var k in obj) iter(obj[k], k, obj)
}

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

function coearseAddress (address) {
  if(isObject(address)) {
    var protocol = 'net'
    if (address.host.endsWith(".onion"))
        protocol = 'onion'
    return [protocol, address.host, address.port].join(':') +'~'+['shs', toBase64(address.key)].join(':')
  }
  return address
}

//opts must have appKey
module.exports = function (opts) {

  var appKey = (opts && opts.caps && opts.caps.shs || opts.appKey)

  opts.permissions = opts.permissions || {}

  var create = Api(opts.permissions ? [{
    permissions: opts.permissions,
    init: function () {}
  }]: null)

  create.createClient = function (opts) {
    if(opts.keys) opts.keys = toSodiumKeys(opts.keys)
    if(opts.seed) opts.seed = toBuffer(opts.seed)

    var shs = Shs({
      keys: opts.keys && toSodiumKeys(opts.keys),
      seed: opts.seed && toBuffer(opts.seed),
      appKey: toBuffer(opts.appKey || appKey),
      timeout: opts.timeout || (opts.timers && opts.timers.handshake) || 5e3
    })

    var ms = MultiServer([
      [Net({}), shs],
      [Onion({}), shs],
      [WS({}), shs]
    ])

    return function (address, cb) {
      address = coearseAddress(address)

      ms.client(address, function (err, stream) {
        if(err) return cb(err)
        var rpc = Muxrpc(opts.manifest || create.manifest, {})({})
        pull(stream, rpc.createStream(), stream)
        cb(null, rpc)
      })
    }
  }

  return create.use({
    manifest: {
      auth: 'async',
      address: 'sync',
      manifest: 'sync',
    },
    init: function (api, opts, permissions, manifest) {

      //XXX: LEGACY CRUFT - TIMEOUTS
      var defaultTimeout = (
        opts.defaultTimeout || 5e3 // 5 seconds.
      )
      var timeout_handshake, timeout_inactivity
      if(opts.timers && !isNaN(opts.timers.handshake))
        timeout_handshake = opts.timers.handshake
      timeout_handshake = timeout_handshake || 5e3

      if(opts.timers && !isNaN(opts.timers.inactivity))
        timeout_inactivity = opts.timers.inactivity

      //if opts.timers are set, pick a longer default
      //but if not, set a short default (as needed in the tests)
      timeout_inactivity = timeout_inactivity || (opts.timers ? 600e3 : 5e3)

      //set all timeouts to one setting, needed in the tests.
      if(opts.timeout)
        timeout_handshake = timeout_inactivity = opts.timeout



      var shsCap = (opts.caps && opts.caps.shs) || opts.appKey || appKey
      var shs = Shs({
        keys: opts.keys && toSodiumKeys(opts.keys),
        seed: opts.seed,
        appKey: toBuffer(shsCap),

        //****************************************
        timeout: timeout_handshake,

        authenticate: function (pub, cb) {
          var id = '@'+u.toId(pub)
          api.auth(id, function (err, auth) {
            if(err) cb(err)
            else    cb(null, auth || create.permissions.anonymous)
          })
        }
      })

      //use configured port, or a random user port.
      var port = opts.port || 1024+(~~(Math.random()*(65536-1024)))
      var host = opts.host || nonPrivate.v4 || nonPrivate.private.v4 || '127.0.0.1'

      var peers = api.peers = {}

      var protocols = [
        [Net({port: port, host: host}), shs],
        [Onion({server: false}), shs]
      ]

      if (opts["tor-only"])
          protocols = [[Onion({server: false}), shs]]

      var ms = MultiServer(protocols)

      var server = ms.server(setupRPC)

      function setupRPC (stream, manf, isClient) {
        var rpc = Muxrpc(create.manifest, manf || create.manifest)(api, stream.auth)
        var rpcStream = rpc.createStream()
        if(timeout_inactivity > 0) rpcStream = Inactive(rpcStream, timeout_inactivity)

        pull(stream, rpcStream, stream)

        var id = rpc.id = '@'+u.toId(stream.remote)

        //keep track of current connections.
        if(!peers[id]) peers[id] = []
        peers[id].push(rpc)
        rpc.once('closed', function () {
          peers[id].splice(peers[id].indexOf(rpc), 1)
        })

        api.emit('rpc:connect', rpc, !!isClient)

        return rpc
      }

      return {
        //can be called remotely.
        publicKey: shs.publicKey,
        auth: function (pub, cb) { cb() },
        address: function () {
          return this.getAddress()
        },
        getAddress: function () {
          return ms.stringify()
        },
        manifest: function () {
          return create.manifest
        },
        getManifest: function () {
          return this.manifest()
        },
        //cannot be called remote.
        connect: function (address, cb) {
          ms.client(coearseAddress(address), function (err, stream) {
            return err ? cb(err) : cb(null, setupRPC(stream, null, true))
          })
        },

        close: function (err, cb) {
          if(isFunction(err)) cb = err, err = null
          api.closed = true
          ;(server.close || server)(function (err) {
            api.emit('close', err)
            cb && cb(err)
          })

          if(err) {
            each(peers, function (connections, id) {
              each(connections, function (rpc) {
                rpc.close(err)
              })
            })
          }
        }
      }
    }
  })
}

