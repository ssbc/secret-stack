const u = require('./util')
// @ts-ignore
const Muxrpc = require('muxrpc')
// @ts-ignore
const pull = require('pull-stream')
// const Rate = require('pull-rate')
// @ts-ignore
const MultiServer = require('multiserver')
// @ts-ignore
const Inactive = require('pull-inactivity')
const debug = require('debug')('secret-stack')

/**
 * @typedef {import('./types').Config} Config
 * @typedef {import('./types').Outgoing} Outgoing
 * @typedef {import('./types').Incoming} Incoming
 * @typedef {import('./types').Transport} Transport
 * @typedef {import('./types').Transform} Transform
 * @typedef {import('./types').ScopeStr} ScopeStr
 */

/**
 * @param {unknown} o
 * @returns {o is Record<string, unknown>}
 */
function isPlainObject (o) {
  return !!o && typeof o === 'object' && !Array.isArray(o)
}

/**
 * @param {Buffer | string} s
 * @returns {string}
 */
function toBase64 (s) {
  if (typeof s === 'string') return s
  else return s.toString('base64') // assume a buffer
}

/**
 * @template T
 * @param {Record<string, T> | Array<T>} objOrArr
 * @param {(t: T, k: string | number, o: Record<string, T> | Array<T>) => void} iter
 */
function each (objOrArr, iter) {
  if (Array.isArray(objOrArr)) {
    objOrArr.forEach(iter)
  } else {
    for (const key in objOrArr) iter(objOrArr[key], key, objOrArr)
  }
}

/**
 *
 * @param {Transform | Transport} obj
 * @param {'transform' | 'transport'} type
 */
function assertHasNameAndCreate (obj, type) {
  if (
    !isPlainObject(obj) ||
    typeof obj.name !== 'string' ||
    typeof obj.create !== 'function'
  ) {
    throw new Error(type + ' must be {name: string, create: function}')
  }
}

/**
 * TODO: should probably replace this with ssb-ref#toMultiServerAddress or
 * just delete this and let multiserver handle invalid addresses. The 2nd option
 * sounds better, because we might already have address validation in ssb-conn
 * and so we don't need that kind of logic in secret-stack anymore.
 *
 * @param {string | Record<string, unknown>} address
 * @returns {string}
 */
function coearseAddress (address) {
  if (isPlainObject(address)) {
    let protocol = 'net'
    if (typeof address.host === 'string' && address.host.endsWith('.onion')) {
      protocol = 'onion'
    }
    return (
      [protocol, address.host, address.port].join(':') +
      '~' +
      ['shs', toBase64(/** @type {string} */ (address.key))].join(':')
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

/**
 * @param {unknown} list
 */
function isPermsList (list) {
  if (list === null) return true
  if (typeof list === 'undefined') return true
  return Array.isArray(list) && list.every((x) => typeof x === 'string')
}

/**
 * @param {unknown} perms
 */
function isPermissions (perms) {
  // allow: null means enable everything.
  return (
    perms &&
    isPlainObject(perms) &&
    isPermsList(perms.allow) &&
    isPermsList(perms.deny)
  )
}

module.exports = {
  manifest: {
    auth: 'async',
    address: 'sync',
    manifest: 'sync',
    multiserver: {
      parse: 'sync',
      address: 'sync'
    }
  },
  permissions: {
    anonymous: {
      allow: ['manifest']
    }
  },

  /**
   *
   * @param {any} api
   * @param {Config} opts
   * @param {any} permissions
   * @param {any} manifest
   * @returns
   */
  init (api, opts, permissions, manifest) {
    /** @type {number} */
    let timeoutInactivity
    if (opts.timers?.inactivity && u.isNumber(opts.timers?.inactivity)) {
      timeoutInactivity = opts.timers?.inactivity
    }
    // if opts.timers are set, pick a longer default
    // but if not, set a short default (as needed in the tests)
    timeoutInactivity ??= opts.timers ? 600e3 : 5e3

    if (!opts.connections) {
      /** @type {Incoming} */
      const netIn = {
        scope: ['device', 'local', 'public'],
        transform: 'shs',
        ...(opts.host ? { host: opts.host } : null),
        ...(opts.port ? { port: opts.port } : null)
      }
      /** @type {Outgoing} */
      const netOut = {
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

    /** @type {Record<string, Array<unknown>>} */
    const peers = (api.peers = {})

    /** @type {Array<Transport>} */
    const transports = []

    /** @type {Array<Transform>} */
    const transforms = []

    /** @type {any} */
    let server
    /** @type {any} */
    let ms
    /** @type {any} */
    let msClient

    function setupMultiserver () {
      if (api.closed) return
      if (server) return server
      if (transforms.length < 1) {
        throw new Error('secret-stack needs at least 1 transform protocol')
      }

      /** @type {Array<[unknown, unknown]>} */
      const serverSuites = []
      /** @type {Array<[unknown, unknown]>} */
      const clientSuites = []

      for (const incTransport in opts.connections?.incoming) {
        opts.connections.incoming[incTransport].forEach((inc) => {
          transforms.forEach((transform) => {
            transports.forEach((transport) => {
              if (
                transport.name === incTransport &&
                transform.name === inc.transform
              ) {
                const msPlugin = transport.create(inc)
                const msTransformPlugin = transform.create()
                if (msPlugin.scope() !== inc.scope) {
                  // prettier-ignore
                  throw new Error('transport:' + transport.name + ' did not remember scope, expected:' + inc.scope + ' got:' + msPlugin.scope())
                }
                // prettier-ignore
                debug('creating server %s %s host=%s port=%d scope=%s', incTransport, transform.name, inc.host, inc.port, inc.scope ?? 'undefined')
                serverSuites.push([msPlugin, msTransformPlugin])
              }
            })
          })
        })
      }

      for (const outTransport in opts.connections?.outgoing) {
        opts.connections.outgoing[outTransport].forEach((out) => {
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

    /**
     * @param {any} stream
     * @param {unknown} manf
     * @param {boolean=} isClient
     */
    function setupRPC (stream, manf, isClient) {
      // idea: make muxrpc part of the multiserver stream so that we can upgrade it.
      //       we'd need to fallback to using default muxrpc on ordinary connections.
      //       but maybe the best way to represent that would be to coearse addresses to
      //       include ~mux1 at the end if they didn't specify a muxrpc version.

      const perms =
        isClient
          ? permissions.anonymous
          : isPermissions(stream.auth)
            ? stream.auth
            : permissions.anonymous
      const rpc = Muxrpc(manifest, manf ?? manifest, api, perms)
      // Legacy ID:
      rpc.id = '@' + u.toId(stream.remote)
      // Modern IDs:
      for (const transform of transforms) {
        if (transform.identify) {
          const identified = transform.identify(stream.remote)
          Object.defineProperty(rpc, transform.name, {
            get () {
              return identified
            }
          })
        }
      }
      let rpcStream = rpc.stream
      if (timeoutInactivity > 0 && api.id !== rpc.id) {
        rpcStream = Inactive(rpcStream, timeoutInactivity)
      }
      rpc.meta = stream.meta
      rpc.stream.address = stream.address

      pull(stream, rpcStream, stream)

      // keep track of current connections.
      peers[rpc.id] ??= []
      peers[rpc.id].push(rpc)
      rpc.once('closed', () => {
        peers[rpc.id].splice(peers[rpc.id].indexOf(rpc), 1)
      })

      api.emit('rpc:connect', rpc, !!isClient)

      return rpc
    }

    return {
      config: opts,
      /**
       * `auth` can be called remotely
       * @param {unknown} _pub
       * @param {Function} cb
       */
      auth (_pub, cb) {
        cb()
      },

      /**
       * @param {ScopeStr=} scope
       */
      address (scope) {
        return api.getAddress(scope)
      },

      /**
       * @param {ScopeStr=} scope
       */
      getAddress (scope) {
        setupMultiserver()
        return ms.stringify(scope) ?? null
      },

      manifest () {
        return manifest
      },

      getManifest () {
        return this.manifest()
      },

      /**
       * `connect` cannot be called remotely
       * @param {string | Record<string, unknown>} address
       * @param {Function} cb
       */
      connect (address, cb) {
        setupMultiserver()
        msClient.client(
          coearseAddress(address),
          /**
           * @param {unknown} err
           * @param {unknown} stream
           */
          (err, stream) => {
            if (err) cb(err)
            else cb(null, setupRPC(stream, null, true))
          }
        )
      },

      multiserver: {
        /**
         * @param {Transport} transport
         */
        transport (transport) {
          if (server) {
            throw new Error('cannot add protocol after server initialized')
          }
          assertHasNameAndCreate(transport, 'transport')
          debug('Adding transport %s', transport.name)
          transports.push(transport)
          return this
        },

        /**
         * @param {Transform} transform
         */
        transform (transform) {
          assertHasNameAndCreate(transform, 'transform')
          debug('Adding transform %s', transform.name)
          transforms.push(transform)
          return this
        },

        /**
         * @param {string} str
         */
        parse (str) {
          return ms.parse(str)
        },

        /**
         * @param {ScopeStr=} scope
         */
        address (scope) {
          setupMultiserver()
          return ms.stringify(scope) || null
        }
      },

      /**
       * @param {unknown} err
       * @param {Function=} cb
       */
      close (err, cb) {
        if (typeof err === 'function') {
          cb = err
          err = null
        }
        api.closed = true
        if (!server) cb?.()
        else {
          (server.close ?? server)((/** @type {any} */ err) => {
            api.emit('close', err)
            cb?.(err)
          })
        }

        if (err) {
          each(peers, (rpcs) => {
            each(rpcs, (/** @type {any} */ rpc) => {
              rpc.close(err)
            })
          })
        }
      }
    }
  }
}
