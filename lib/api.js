const u = require('./util')
const EventEmitter = require('events')
// @ts-ignore
const Hookable = require('hoox')

/**
 * @template T
 * @param {T} x
 * @returns {T}
 */
function identity (x) {
  return x
}

/**
 * @param {any} a
 * @param {any} b
 * @param {any=} mapper
 */
function merge (a, b, mapper) {
  mapper = mapper ?? identity
  for (const k in b) {
    if (
      b[k] &&
      typeof b[k] === 'object' &&
      !Buffer.isBuffer(b[k]) &&
      !(b[k] instanceof Uint8Array) &&
      !Array.isArray(b[k])
    ) {
      a[k] ??= {}
      merge(a[k], b[k], mapper)
    } else {
      a[k] = mapper(b[k], k)
    }
  }
  return a
}

/**
 * @param {Record<string, any>} obj
 * @param {{name?: string}} plugin
 */
function pluckOpts (obj, plugin) {
  if (plugin.name) {
    const camelCaseName = /** @type {string} */ (u.toCamelCase(plugin.name))
    return { [camelCaseName]: obj[camelCaseName], global: obj.global ?? {} }
  } else {
    return { global: obj.global ?? {} }
  }
}

/**
 * @param {Array<any>} plugins
 * @param {any} defaultConfig
 */
function Api (plugins, defaultConfig) {
  /**
   * @param {any} inputOpts
   */
  function create (inputOpts) {
    const opts = merge(merge({}, defaultConfig), inputOpts)
    // change event emitter to something with more rigorous security?
    let api = new EventEmitter()
    for (const plug of create.plugins) {
      const subOpts = pluckOpts(opts, plug)
      let _api = plug.init.call(
        {},
        api,
        subOpts,
        create.permissions,
        create.manifest
      )
      if (plug.name) {
        const camelCaseName = u.toCamelCase(plug.name)
        if (camelCaseName) {
          /** @type {Record<string, unknown>} */
          const o = {}
          o[camelCaseName] = _api
          _api = o
        }
      }
      api = merge(
        api,
        _api,
        /**
         * @param {any} val
         * @param {number | string} key
         */
        (val, key) => {
          if (typeof val === 'function') {
            val = Hookable(val)
            if (plug.manifest && plug.manifest[key] === 'sync') {
              u.hookOptionalCB(val)
            }
          }
          return val
        }
      )
    }
    return api
  }

  create.plugins = /** @type {Array<any>} */ ([])
  create.manifest = {}
  create.permissions = {}

  create.use =
    /**
     * @param {any} plug
     */
    function use (plug) {
      if (Array.isArray(plug)) {
        plug.forEach(create.use)
        return create
      }

      if (!plug.init) {
        if (typeof plug === 'function') {
          create.plugins.push({ init: plug })
          return create
        } else {
          throw new Error('plugins *must* have "init" method')
        }
      }

      if (plug.name && typeof plug.name === 'string') {
        if (plug.name === 'global') {
          console.error('plugin named "global" is reserved, skipping')
          return create
        }
        const found = create.plugins.some((p) => p.name === plug.name)
        if (found) {
          // prettier-ignore
          console.error('plugin named:' + plug.name + ' is already loaded, skipping')
          return create
        }
      }

      const name = plug.name
      if (plug.manifest) {
        create.manifest = u.merge.manifest(
          create.manifest,
          plug.manifest,
          u.toCamelCase(name)
        )
      }
      if (plug.permissions) {
        create.permissions = u.merge.permissions(
          create.permissions,
          plug.permissions,
          u.toCamelCase(name)
        )
      }
      create.plugins.push(plug)

      return create
    }

  for (const plugin of (plugins ?? [])) {
    if (plugin) {
      create.use(plugin)
    }
  }

  return create
}

module.exports = Api
