import * as u from './util'
const Muxrpc = require('muxrpc')
const pull = require('pull-stream')
// const Rate = require('pull-rate')
const MultiServer = require('multiserver')
const Inactive = require('pull-inactivity')
const debug = require('debug')('secret-stack')

function isPlainObject (o: any): any {
  return o && typeof o === 'object' && !Array.isArray(o)
}

function toBase64 (s: Buffer | string) {
  if (typeof s === 'string') return s
  else return s.toString('base64') // assume a buffer
}

function each (objOrArr: Record<string, any> | Array<any>, iter: any) {
  if (Array.isArray(objOrArr)) {
    objOrArr.forEach(iter)
  } else {
    for (const key in objOrArr) iter(objOrArr[key], key, objOrArr)
  }
}

function assertHasNameAndCreate (
  obj: Record<string, any>,
  type: 'transform' | 'transport'
) {
  if (
    !isPlainObject(obj) ||
    typeof obj.name !== 'string' ||
    typeof obj.create !== 'function'
  ) {
    throw new Error(type + ' must be {name: string, create: function}')
  }
}

function coearseAddress (address: any) {
  if (isPlainObject(address)) {
    let protocol = 'net'
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
  const meta = { tx: 0, rx: 0, pk: 0 }
  stream = Rate(stream, function (len, up) {
    meta.pk++
    if (up) meta.tx += len
    else meta.rx += len
  })
  stream.meta = meta
  return stream
}
*/

function isPermsList (list: Array<any> | null | undefined) {
  if (list === null) return true
  if (typeof list === 'undefined') return true
  return Array.isArray(list) && list.every((x) => typeof x === 'string')
}

function isPermissions (perms: any) {
  // allow: null means enable everything.
  return (
    perms &&
    isPlainObject(perms) &&
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
  init (api: any, opts: any, permissions: any, manifest: any) {
    // defaults
    //      opts.appKey = opts.appKey || appKey

    let timeoutInactivity: number
    if (opts.timers && !isNaN(opts.timers.inactivity)) {
      timeoutInactivity = opts.timers.inactivity
    }
    // if opts.timers are set, pick a longer default
    // but if not, set a short default (as needed in the tests)
    timeoutInactivity = timeoutInactivity! || (opts.timers ? 600e3 : 5e3)

    if (!opts.connections) {
      const netIn: any = {
        scope: ['device', 'local', 'public'],
        transform: 'shs'
      }
      const netOut: any = { transform: 'shs' }
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
    const peers: any = (api.peers = {})

    const transports: Array<any> = []

    const transforms: Array<any> = []

    let server: any
    let ms: any
    let msClient: any

    function setupMultiserver () {
      if (api.closed) return
      if (server) return server
      if (transforms.length < 1) {
        throw new Error('secret-stack needs at least 1 transform protocol')
      }

      const serverSuites: Array<any> = []
      const clientSuites: Array<any> = []

      for (const incTransportType in opts.connections.incoming) {
        opts.connections.incoming[incTransportType].forEach((conf: any) => {
          transforms.forEach((transform) => {
            transports.forEach((transport) => {
              if (
                transport.name === incTransportType &&
                transform.name === conf.transform
              ) {
                const trans = transport.create(conf)
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

      for (const outTransportType in opts.connections.outgoing) {
        opts.connections.outgoing[outTransportType].forEach((conf: any) => {
          transforms.forEach((transform) => {
            transports.forEach((transport) => {
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
      server = ms.server(setupRPC, null, () => {
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

      const _id = '@' + u.toId(stream.remote)
      const rpc = Muxrpc(
        manifest,
        manf ?? manifest,
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
      let rpcStream = rpc.stream
      if (timeoutInactivity > 0 && api.id !== rpc.id) {
        rpcStream = Inactive(rpcStream, timeoutInactivity)
      }
      rpc.meta = stream.meta
      rpc.stream.address = stream.address

      pull(stream, rpcStream, stream)

      // keep track of current connections.
      if (!peers[rpc.id]) peers[rpc.id] = []
      peers[rpc.id].push(rpc)
      rpc.once('closed', () => {
        peers[rpc.id].splice(peers[rpc.id].indexOf(rpc), 1)
      })

      api.emit('rpc:connect', rpc, !!isClient)

      return rpc
    }

    return {
      config: opts,
      // can be called remotely.
      auth (_pub: any, cb: Function) {
        cb()
      },
      address (scope?: any) {
        return api.getAddress(scope)
      },
      getAddress (scope?: any) {
        setupMultiserver()
        return ms.stringify(scope) || null
      },
      manifest () {
        return manifest
      },
      getManifest () {
        return this.manifest()
      },
      // cannot be called remote.
      connect (address: any, cb: Function) {
        setupMultiserver()
        msClient.client(coearseAddress(address), (err: any, stream: any) => {
          if (err) cb(err)
          else cb(null, setupRPC(stream, null, true))
        })
      },

      multiserver: {
        transport (transport: any) {
          if (server) {
            throw new Error('cannot add protocol after server initialized')
          }
          assertHasNameAndCreate(transport, 'transport')
          debug('Adding transport %s', transport.name)
          transports.push(transport)
          return this
        },
        transform (transform: any) {
          assertHasNameAndCreate(transform, 'transform')
          debug('Adding transform %s', transform.name)
          transforms.push(transform)
          return this
        },
        parse (str: string) {
          return ms.parse(str)
        },
        address (scope?: any) {
          setupMultiserver()
          return ms.stringify(scope) || null
        }
      },
      close (err: any, cb: Function) {
        if (typeof err === 'function') {
          cb = err
          err = null
        }
        api.closed = true
        if (!server) cb && cb()
        else {
          (server.close ?? server)((err: any) => {
            api.emit('close', err)
            cb && cb(err)
          })
        }

        if (err) {
          each(peers, (connections: any) => {
            each(connections, (rpc: any) => {
              rpc.close(err)
            })
          })
        }
      }
    }
  }
};
