var u          = require('./util')
var Api        = require('./api')
var Muxrpc     = require('muxrpc')
var pull       = require('pull-stream')
var msSHS = require('multiserver/plugins/shs')
var msNet = require('multiserver/protocols/net')()
var msOnion = require('multiserver/protocols/onion')()
var nonPrivate = require('non-private-ip')
var Inactive   = require('pull-inactivity')

function isFunction (f) { return 'function' === typeof f }

function isString (s) { return 'string' === typeof s }

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
  if(isString(address)) address = u.parseAddress(address)
  if(isString(address.key))
    return {
      host: address.host, port: address.port,
      key: new Buffer(
        address.key
          .substring(1, address.key.indexOf('.')),
        'base64'
      )
    }
  return address
}

//opts must have appKey
module.exports = function (opts) {

  var appKey = opts.appKey
  var defaultTimeout = (
    opts.defaultTimeout || 5e3 // 5 seconds.
  )
  var timeout_handshake

  if(opts.timers && !isNaN(opts.timers.inactivity))
    defaultTimeout = opts.timers.inactivity
  if(opts.timers && !isNaN(opts.timers.handshake))
    timeout_handshake = opts.timers.handshake
  timeout_handshake = timeout_handshake || 5e3

  opts.permissions = opts.permissions || {}

  var create = Api(opts.permissions ? [{
    permissions: opts.permissions,
    init: function () {}
  }]: null)

  create.createClient = function (opts) {
    if(opts.keys) opts.keys = toSodiumKeys(opts.keys)
    if(opts.seed) opts.seed = toBuffer(opts.seed)
//    opts.appKey = toBuffer(opts.appKey || appKey)

    var snet = msSHS({
      keys: opts.keys && toSodiumKeys(opts.keys),
      seed: opts.seed && toBuffer(opts.seed),
      appKey: toBuffer(opts.appKey || appKey),
      timeout: opts.timeout || (opts.timers && opts.timers.handshake) || 5e3
    })

    return function (address, cb) {
      address = coearseAddress(address)

      snet.connect(address, function (err, stream) {
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
      var snet = msSHS({
        keys: opts.keys && toSodiumKeys(opts.keys),
        seed: opts.seed,
        appKey: toBuffer(opts.appKey || appKey),

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

      var server;
      if (host.indexOf(".onion") != -1)
          server = msOnion.createServer(port, setupRPC)
      else
          server = msNet.createServer(port, setupRPC)

      function setupRPC (stream, manf, isClient) {
        var rpc = Muxrpc(create.manifest, manf || create.manifest)(api, stream.auth)
        var timeout = opts.timeout == null ? defaultTimeout : opts.timeout
        var rpcStream = rpc.createStream()
        if(timeout > 0) rpcStream = Inactive(rpcStream, opts.timeout)

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
        publicKey: snet.publicKey,
        auth: function (pub, cb) { cb() },
        address: function () {
          return this.getAddress()
        },
        getAddress: function () {
          return [host, port, '@'+u.toId(snet.publicKey)].join(':')
        },
        manifest: function () {
          return create.manifest
        },
        getManifest: function () {
          return this.manifest()
        },
        //cannot be called remote.
        connect: function (address, cb) {
          address = coearseAddress(address)
          address.appKey = opts.appKey || appKey

          var net = msNet
          if (address.host.indexOf(".onion") != -1)
              net = msOnion

          net.connect(address, function (err, stream) {
            return err ? cb(err) : cb(null, setupRPC(stream, null, true))
          })
        },

        close: function (err, cb) {
          if(isFunction(err)) cb = err, err = null
          api.closed = true
          server.close(function (err) {
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



