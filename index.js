var u          = require('./util')
var Api        = require('./api')
var Muxrpc     = require('muxrpc')
var pull       = require('pull-stream')
var createNode = require('secret-handshake/net')
var nonPrivate = require('non-private-ip')
var Inactive   = require('pull-inactivity')

function isFunction (f) { return 'function' === typeof f }

function isString (s) { return 'string' === typeof s }

function each(obj, iter) {
  if(Array.isArray(obj)) return obj.forEach(iter)
  for(var k in obj) iter(obj[k], k, obj)
}

//opts must have appKey
module.exports = function (opts) {

  var appKey = opts.appKey

  opts.permissions = opts.permissions || {}

  var create = Api(opts.permissions ? [{
    permissions: opts.permissions,
    init: function () {}
  }]: null)

  return create.use({
    manifest: {
      auth: 'async',
      address: 'sync',
      manifest: 'sync',
    },
    init: function (api, opts, permissions, manifest) {
      var snet = createNode({
        keys: opts.keys,
        seed: opts.seed,
        appKey: appKey,
        authenticate: function (pub, cb) {
          var id = u.toId(pub)
          api.auth(id, function (err, auth) {
            if(err) cb(err)
            else    cb(null, auth || create.permissions.anonymous)
          })
        }
      })

      //use configured port, or a random user port.
      var port = opts.port || 1024+(~~(Math.random()*(65536-1024)))

      var peers = api.peers = {}

      var server = snet.createServer(setupRPC).listen(port)

      function setupRPC (stream) {
        var rpc = Muxrpc(create.manifest, create.manifest)(api, stream.auth)
        var timeout = opts.timeout || 5e3
        var rpcStream = rpc.createStream()
        if(opts.timeout) rpcStream = Inactive(rpcStream, opts.timeout)

        pull(stream, rpcStream, stream)

        var id = rpc.id = u.toId(stream.remote)

        //keep track of current connections.
        if(!peers[id]) peers[id] = []
        peers[id].push(rpc)
        rpc.once('closed', function () {
          peers[id].splice(peers[id].indexOf(rpc), 1)
        })

        api.emit('rpc:connect', rpc)

        return rpc
      }

      return {
        //can be called remotely.
        publicKey: snet.publicKey,
        auth: function (pub, cb) { cb() },
        address: function () {
                var host = nonPrivate() || nonPrivate.private() || '127.0.0.1'
          return [host, port, u.toId(snet.publicKey)].join(':')
        },
        manifest: function () {
          return create.manifest
        },

        //cannot be called remote.
        connect: function (address, cb) {
          if(isString(address)) address = u.parseAddress(address)

          snet.connect(address, function (err, stream) {
            return err ? cb(err) : cb(null, setupRPC(stream))
          })
        },

        close: function (err, cb) {
          if(isFunction(err)) cb = err, err = null

          server.close(function (err) {
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

