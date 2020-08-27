import * as u from './util'
import {
  Config,
  Outgoing,
  Incoming,
  Transport,
  Transform,
  ScopeStr,
  RPC
} from './types'
const Muxrpc = require('muxrpc')
const pull = require('pull-stream')
// const Rate = require('pull-rate')
const MultiServer = require('multiserver')
const Inactive = require('pull-inactivity')
const debug = require('debug')('secret-stack')

function isPlainObject (o: unknown): o is Record<string, unknown> {
  return o && typeof o === 'object' && !Array.isArray(o)
}

function toBase64 (s: Buffer | string) {
  if (typeof s === 'string') return s
  else return s.toString('base64') // assume a buffer
}

function each<T> (
  objOrArr: Record<string, T> | Array<T>,
  iter: (t: T, k: string | number, o: Record<string, T> | Array<T>) => void
) {
  if (Array.isArray(objOrArr)) {
    objOrArr.forEach(iter)
  } else {
    for (const key in objOrArr) iter(objOrArr[key], key, objOrArr)
  }
}

function assertHasNameAndCreate (
  obj: Transform | Transport,
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

// TODO: should probably replace this with ssb-ref#toMultiServerAddress or
// just delete this and let multiserver handle invalid addresses. The 2nd option
// sounds better, because we might already have address validation in ssb-conn
// and so we don't need that kind of logic in secret-stack anymore.
function coearseAddress (address: unknown) {
  if (isPlainObject(address)) {
    let protocol = 'net'
    if (typeof address.host === 'string' && address.host.endsWith('.onion')) {
      protocol = 'onion'
    }
    return (
      [protocol, address.host, address.port].join(':') +
      '~' +
      ['shs', toBase64(address.key as string)].join(':')
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

function isPermsList (list: unknown) {
  if (list === null) return true
  if (typeof list === 'undefined') return true
  return Array.isArray(list) && list.every((x) => typeof x === 'string')
}

function isPermissions (perms: unknown) {
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
  init (api: any, opts: Config, permissions: any, manifest: any) {
    let timeoutInactivity: number
    if (!isNaN(opts.timers?.inactivity as any)) {
      timeoutInactivity = opts.timers?.inactivity!
    }
    // if opts.timers are set, pick a longer default
    // but if not, set a short default (as needed in the tests)
    timeoutInactivity = timeoutInactivity! || (opts.timers ? 600e3 : 5e3)

    if (!opts.connections) {
      const netIn: Incoming = {
        scope: ['device', 'local', 'public'],
        transform: 'shs',
        ...(opts.host ? {host: opts.host} : null),
        ...(opts.port ? {port: opts.port} : null),
      }
      const netOut: Outgoing = {
        transform: 'shs'
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
    const peers: Record<string, Array<RPC>> = (api.peers = {})

    const transports: Array<Transport> = []

    const transforms: Array<Transform> = []

    let server: any
    let ms: any
    let msClient: any

    function setupMultiserver () {
      if (api.closed) return
      if (server) return server
      if (transforms.length < 1) {
        throw new Error('secret-stack needs at least 1 transform protocol')
      }

      const serverSuites: Array<[unknown, unknown]> = []
      const clientSuites: Array<[unknown, unknown]> = []

      for (const incTransport in opts.connections!.incoming) {
        opts.connections!.incoming[incTransport].forEach((inc) => {
          transforms.forEach((transform) => {
            transports.forEach((transport) => {
              if (
                transport.name === incTransport &&
                transform.name === inc.transform
              ) {
                const msPlugin = transport.create(inc)
                const msTransformPlugin = transform.create()
                if (msPlugin.scope() !== inc.scope) {
                  throw new Error(
                    'transport:' +
                      transport.name +
                      ' did not remember scope, expected:' +
                      inc.scope +
                      ' got:' +
                      msPlugin.scope()
                  )
                }
                debug(
                  'creating server %s %s host=%s port=%d scope=%s',
                  incTransport,
                  transform.name,
                  inc.host,
                  inc.port,
                  inc.scope || 'undefined'
                )
                serverSuites.push([msPlugin, msTransformPlugin])
              }
            })
          })
        })
      }

      for (const outTransport in opts.connections!.outgoing) {
        opts.connections!.outgoing[outTransport].forEach((out) => {
          transforms.forEach((transform) => {
            transports.forEach((transport) => {
              if (
                transport.name === outTransport &&
                transform.name === out.transform
              ) {
                const msPlugin = transport.create(out)
                const msTransformPlugin = transform.create()
                clientSuites.push([msPlugin, msTransformPlugin])
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

    function setupRPC (stream: any, manf: unknown, isClient?: boolean) {
      // idea: make muxrpc part of the multiserver stream so that we can upgrade it.
      //       we'd need to fallback to using default muxrpc on ordinary connections.
      //       but maybe the best way to represent that would be to coearse addresses to
      //       include ~mux1 at the end if they didn't specify a muxrpc version.

      const _id = '@' + u.toId(stream.remote)
      const rpc: RPC = Muxrpc(
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
        peers[rpc.id!].splice(peers[rpc.id!].indexOf(rpc), 1)
      })

      api.emit('rpc:connect', rpc, !!isClient)

      return rpc
    }

    return {
      config: opts,
      // can be called remotely.
      auth (_pub: unknown, cb: Function) {
        cb()
      },
      address (scope?: ScopeStr) {
        return api.getAddress(scope)
      },
      getAddress (scope?: ScopeStr) {
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
      connect (address: unknown, cb: Function) {
        setupMultiserver()
        msClient.client(
          coearseAddress(address),
          (err: unknown, stream: unknown) => {
            if (err) cb(err)
            else cb(null, setupRPC(stream, null, true))
          }
        )
      },

      multiserver: {
        transport (transport: Transport) {
          if (server) {
            throw new Error('cannot add protocol after server initialized')
          }
          assertHasNameAndCreate(transport, 'transport')
          debug('Adding transport %s', transport.name)
          transports.push(transport)
          return this
        },
        transform (transform: Transform) {
          assertHasNameAndCreate(transform, 'transform')
          debug('Adding transform %s', transform.name)
          transforms.push(transform)
          return this
        },
        parse (str: string) {
          return ms.parse(str)
        },
        address (scope?: ScopeStr) {
          setupMultiserver()
          return ms.stringify(scope) || null
        }
      },
      close (err: unknown, cb: Function) {
        if (typeof err === 'function') {
          cb = err
          err = null
        }
        api.closed = true
        if (!server) cb && cb()
        else {
          (server.close ?? server)((err: unknown) => {
            api.emit('close', err)
            cb && cb(err)
          })
        }

        if (err) {
          each(peers, (connections) => {
            each(connections, (rpc) => {
              rpc.close(err)
            })
          })
        }
      }
    }
  }
}
