'use strict'
var u          = require('./util')
var Api        = require('./api')
var Muxrpc     = require('muxrpc')
var pull       = require('pull-stream')
var Rate       = require('pull-rate')

var MultiServer = require('multiserver')
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

function coearseAddress (address) {
  if(isObject(address)) {
    var protocol = 'net'
    if (address.host.endsWith(".onion"))
        protocol = 'onion'
    return [protocol, address.host, address.port].join(':') +'~'+['shs', toBase64(address.key)].join(':')
  }
  return address
}

var ip = require('ip')

function parse(addr) {
  var parts = addr.split('~')[0].split(':')
  var protocol = parts[0], host = parts[1]
  return {
    protocol: protocol,
    group: (ip.isLoopback(host) || !host) ? 'loopback' : ip.isPrivate(host) ? 'local' : 'internet',
    host: host
  }
}

function msLogger (stream) {
  var meta = {tx: 0, rx:0, pk: 0}
  stream = Rate(stream, function (len, up) {
    meta.pk ++
    if(up) meta.tx += len
    else meta.rx += len
  })
  stream.meta = meta
  return stream
}


//opts must have appKey
module.exports = function (opts) {
  //this weird thing were some config is loaded first, then the rest later... not necessary.
  var _opts = opts
  var appKey = (opts && opts.caps && opts.caps.shs || opts.appKey)

  opts.permissions = opts.permissions || {}

  var create = Api(opts.permissions ? [{
    permissions: opts.permissions,
    init: function () {}
  }]: null)

  return create
  .use({
    manifest: {
      auth: 'async',
      address: 'sync',
      manifest: 'sync',
    },
    init: function (api, opts, permissions, manifest) {

      // defaults
      opts.appKey = opts.appKey || appKey

      //XXX: LEGACY CRUFT - TIMEOUTS
      var defaultTimeout = opts.defaultTimeout || 5e3 // 5 seconds.
      var timeout_inactivity

      if(opts.timers && !isNaN(opts.timers.inactivity))
        timeout_inactivity = opts.timers.inactivity

      // if opts.timers are set, pick a longer default
      // but if not, set a short default (as needed in the tests)
      timeout_inactivity = timeout_inactivity || (opts.timers ? 600e3 : 5e3)

      if (!opts.connections)
        opts.connections = {
          incoming: {
            net: [{ scope: "public", "transform": "shs" }]
          },
          outgoing: {
            net: [{ transform: "shs" }]
          }
        }

      var peers = api.peers = {}

      var transports = []

      var transforms = [
        //function () { return shs }
      ]

      var server, ms, ms_client

      function setupMultiserver () {
        if(api.closed) return
        if(server) return server
        if(transforms.length < 1)
          throw new Error('secret-stack needs at least 1 transform protocol')

        var server_suites = []
        var client_suites = []

        for (var incTransportType in opts.connections.incoming) {
          opts.connections.incoming[incTransportType].forEach(function (conf) {
            transforms.forEach(function (transform) {
              transports.forEach(function (transport) {
                if (transport.name == incTransportType && transform.name == conf.transform) {
                  var trans = transport.create(conf)
                  if(trans.scope() !== conf.scope)
                    throw new Error('transport:'+transport.name +' did not remember scope, expected:' + conf.scope + ' got:'+trans.scope())
                  server_suites.push([
                    transport.create(conf),
                    transform.create()
                  ])
                }
              })
            })
          })
        }

        for (var outTransportType in opts.connections.outgoing) {
          opts.connections.outgoing[outTransportType].forEach(function (conf) {
            transforms.forEach(function (transform) {
              transports.forEach(function (transport) {
                if (transport.name == outTransportType && transform.name == conf.transform)
                  client_suites.push([
                    transport.create(conf),
                    transform.create()
                  ])
              })
            })
          })
        }

        ms_client = MultiServer(client_suites)

        ms = MultiServer(server_suites)
        server = ms.server(setupRPC)
        if(!server) throw new Error('expected server')
        return server
      }

      setImmediate(setupMultiserver)

      function setupRPC (stream, manf, isClient) {
        var rpc = Muxrpc(create.manifest, manf || create.manifest)(api, stream.auth === true ? create.permissions.anonymous : stream.auth)
        var rpcStream = rpc.createStream()
        rpc.id = '@'+u.toId(stream.remote)
        if(timeout_inactivity > 0 && api.id !== rpc.id) rpcStream = Inactive(rpcStream, timeout_inactivity)
        rpc.meta = stream.meta

        pull(stream, rpcStream, stream)

        //keep track of current connections.
        if(!peers[rpc.id]) peers[rpc.id] = []
        peers[rpc.id].push(rpc)
        rpc.once('closed', function () {
          peers[rpc.id].splice(peers[rpc.id].indexOf(rpc), 1)
        })

        api.emit('rpc:connect', rpc, !!isClient)

        return rpc
      }

      return {
        config: opts,
        //can be called remotely.
        auth: function (pub, cb) { cb() },
        address: function (scope) {
          return api.getAddress(scope)
        },
        getAddress: function (scope) {
          setupMultiserver()
          return ms.stringify(scope) || null
        },
        manifest: function () {
          return create.manifest
        },
        getManifest: function () {
          return this.manifest()
        },
        //cannot be called remote.
        connect: function (address, cb) {
          setupMultiserver()
          ms_client.client(coearseAddress(address), function (err, stream) {
            return err ? cb(err) : cb(null, setupRPC(stream, null, true))
          })
        },

        multiserver: {
          transport: function (transport) {
            if(server) throw new Error('cannot add protocol after server initialized')
            if(!isObject(transport) && isString(transport.name) && isFunction(transport.create))
              throw new Error('transport must be {name: string, create: function}') 
            transports.push(transport); return this
          },
          transform: function (transform) {
            if(!isObject(transform) && isString(transform.name) && isFunction(transform.create))
              throw new Error('transform must be {name: string, create: function}') 
            transforms.push(transform); return this
          },
          parse: function (str) {
            return ms.parse(str)
          }
        },
        close: function (err, cb) {
          if(isFunction(err)) cb = err, err = null
          api.closed = true
          if(!server) cb && cb()
          else {
            ;(server.close || server)(function (err) {
              api.emit('close', err)
              cb && cb(err)
            })
          }

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
  //default network plugins
  .use(require('./plugins/net'))
  .use(require('./plugins/shs'))
}

