import * as u from './util'
var Muxrpc = require('muxrpc')
var pull = require('pull-stream')
// var Rate = require('pull-rate')
var MultiServer = require('multiserver')
var Inactive = require('pull-inactivity')
var debug = require('debug')('secret-stack')

function isFunction (f: any): f is Function {
  return typeof f === 'function'
}

function isString (s: any): s is string {
  return typeof s === 'string'
}

function isObject (o: any): any {
  return o && typeof o === 'object' && !Array.isArray(o)
}

var isArray = Array.isArray

function toBase64 (s: Buffer | string) {
  if (isString(s)) return s
  else return s.toString('base64') // assume a buffer
}

function each (obj: any, iter: any) {
  if (Array.isArray(obj)) return obj.forEach(iter)
  for (var k in obj) iter(obj[k], k, obj)
}

function coearseAddress (address: any) {
  if (isObject(address)) {
    var protocol = 'net'
    if (address.host.endsWith('.onion')) {
      protocol = 'onion'
    }
    return (
      [protocol, address.host, address.port].join(':') +
      '~' +
      ['shs', toBase64(address.key)].join(':')
    )
  }
  return address
}

/*
// Could be useful
function msLogger (stream) {
  var meta = { tx: 0, rx: 0, pk: 0 }
  stream = Rate(stream, function (len, up) {
    meta.pk++
    if (up) meta.tx += len
    else meta.rx += len
  })
  stream.meta = meta
  return stream
}
*/

function isPermsList (list: any) {
  return list == null || (isArray(list) && list.every(isString))
}

function isPermissions (perms: any) {
  // allow: null means enable everything.
  return (
    perms &&
    isObject(perms) &&
    isPermsList(perms.allow) &&
    isPermsList(perms.deny)
  )
}

export = {
  manifest: {
    auth: 'async',
    address: 'sync',
    manifest: 'sync',
    multiserver: {
      parse: 'sync',
      address: 'sync'
    }
  },
  init: function (api: any, opts: any, permissions: any, manifest: any) {
    // defaults
    //      opts.appKey = opts.appKey || appKey

    var timeoutInactivity: number
    if (opts.timers && !isNaN(opts.timers.inactivity)) {
      timeoutInactivity = opts.timers.inactivity
    }
    // if opts.timers are set, pick a longer default
    // but if not, set a short default (as needed in the tests)
    timeoutInactivity = timeoutInactivity! || (opts.timers ? 600e3 : 5e3)

    if (!opts.connections) {
      var netIn: any = { scope: ['device', 'local', 'public'], transform: 'shs' }
      var netOut: any = { transform: 'shs' }
      // avoid setting properties to value `undefined`
      if (opts.host) netIn.host = opts.host
      if (opts.port) {
        netIn.port = opts.port
      }
      opts.connections = {
        incoming: {
          net: [netIn]
        },
        outgoing: {
          net: [netOut]
        }
      }
    }
    var peers: any = (api.peers = {})

    var transports: Array<any> = []

    var transforms: Array<any> = [
      // function () { return shs }
    ]

    var server: any
    var ms: any
    var msClient: any

    function setupMultiserver () {
      if (api.closed) return
      if (server) return server
      if (transforms.length < 1) {
        throw new Error('secret-stack needs at least 1 transform protocol')
      }

      var serverSuites: Array<any> = []
      var clientSuites: Array<any> = []

      for (var incTransportType in opts.connections.incoming) {
        opts.connections.incoming[incTransportType].forEach(function (
          conf: any
        ) {
          transforms.forEach(function (transform) {
            transports.forEach(function (transport) {
              if (
                transport.name === incTransportType &&
                transform.name === conf.transform
              ) {
                var trans = transport.create(conf)
                if (trans.scope() !== conf.scope) {
                  throw new Error(
                    'transport:' +
                      transport.name +
                      ' did not remember scope, expected:' +
                      conf.scope +
                      ' got:' +
                      trans.scope()
                  )
                }
                debug(
                  'creating server %s %s host=%s port=%d scope=%s',
                  incTransportType,
                  transform.name,
                  conf.host,
                  conf.port,
                  conf.scope || 'undefined'
                )
                serverSuites.push([transport.create(conf), transform.create()])
              }
            })
          })
        })
      }

      for (var outTransportType in opts.connections.outgoing) {
        opts.connections.outgoing[outTransportType].forEach(function (
          conf: any
        ) {
          transforms.forEach(function (transform) {
            transports.forEach(function (transport) {
              if (
                transport.name === outTransportType &&
                transform.name === conf.transform
              ) {
                clientSuites.push([transport.create(conf), transform.create()])
              }
            })
          })
        })
      }

      msClient = MultiServer(clientSuites)

      ms = MultiServer(serverSuites)
      server = ms.server(setupRPC, null, function () {
        api.emit('multiserver:listening') // XXX return all scopes listing on?
      })
      if (!server) throw new Error('expected server')
      return server
    }

    setImmediate(setupMultiserver)

    function setupRPC (stream: any, manf: any, isClient?: boolean) {
      // idea: make muxrpc part of the multiserver stream so that we can upgrade it.
      //       we'd need to fallback to using default muxrpc on ordinary connections.
      //       but maybe the best way to represent that would be to coearse addresses to
      //       include ~mux1 at the end if they didn't specify a muxrpc version.

      var _id = '@' + u.toId(stream.remote)
      var rpc = Muxrpc(
        manifest,
        manf || manifest,
        api,
        _id,
        isClient
          ? permissions.anonymous
          : isPermissions(stream.auth)
            ? stream.auth
            : permissions.anonymous,
        false
      )
      rpc.id = _id
      var rpcStream = rpc.stream
      if (timeoutInactivity > 0 && api.id !== rpc.id) {
        rpcStream = Inactive(rpcStream, timeoutInactivity)
      }
      rpc.meta = stream.meta
      rpc.stream.address = stream.address

      pull(stream, rpcStream, stream)

      // keep track of current connections.
      if (!peers[rpc.id]) peers[rpc.id] = []
      peers[rpc.id].push(rpc)
      rpc.once('closed', function () {
        peers[rpc.id].splice(peers[rpc.id].indexOf(rpc), 1)
      })

      api.emit('rpc:connect', rpc, !!isClient)

      return rpc
    }

    return {
      config: opts,
      // can be called remotely.
      auth: function (_pub: any, cb: Function) {
        cb()
      },
      address: function (scope?: any) {
        return api.getAddress(scope)
      },
      getAddress: function (scope?: any) {
        setupMultiserver()
        return ms.stringify(scope) || null
      },
      manifest: function () {
        return manifest
      },
      getManifest: function () {
        return this.manifest()
      },
      // cannot be called remote.
      connect: function (address: any, cb: Function) {
        setupMultiserver()
        msClient.client(coearseAddress(address), function (
          err: any,
          stream: any
        ) {
          return err ? cb(err) : cb(null, setupRPC(stream, null, true))
        })
      },

      multiserver: {
        transport: function (transport: any) {
          if (server) {
            throw new Error('cannot add protocol after server initialized')
          }
          if (
            !isObject(transport) &&
            isString(transport.name) &&
            isFunction(transport.create)
          ) {
            throw new Error(
              'transport must be {name: string, create: function}'
            )
          }
          debug('Adding transport %s', transport.name)
          transports.push(transport)
          return this
        },
        transform: function (transform: any) {
          if (
            !isObject(transform) &&
            isString(transform.name) &&
            isFunction(transform.create)
          ) {
            throw new Error(
              'transform must be {name: string, create: function}'
            )
          }
          debug('Adding transform %s', transform.name)
          transforms.push(transform)
          return this
        },
        parse: function (str: string) {
          return ms.parse(str)
        },
        address: function (scope?: any) {
          setupMultiserver()
          return ms.stringify(scope) || null
        }
      },
      close: function (err: any, cb: Function) {
        if (isFunction(err)) {
          cb = err
          err = null
        }
        api.closed = true
        if (!server) cb && cb()
        else {
          (server.close || server)(function (err: any) {
            api.emit('close', err)
            cb && cb(err)
          })
        }

        if (err) {
          each(peers, function (connections: any) {
            each(connections, function (rpc: any) {
              rpc.close(err)
            })
          })
        }
      }
    }
  }
};
