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
 * @param {Record<string, any>} fullConfig
 * @param {{name?: string}} plugin
 */
function buildPluginConfig (fullConfig, plugin) {
  if (plugin.name) {
    const camelCaseName = /** @type {string} */ (u.toCamelCase(plugin.name))
    return {
      [camelCaseName]: fullConfig[camelCaseName],
      global: fullConfig.global ?? {}
    }
  } else {
    return {
      global: fullConfig.global ?? {}
    }
  }
}

/**
 * @param {Array<any>} plugins
 * @param {any} defaultConfig
 */
function Api (plugins, defaultConfig) {
  /**
   * @param {any} inputConfig
   */
  function create (inputConfig) {
    const config = merge(merge({}, defaultConfig), inputConfig)
    // change event emitter to something with more rigorous security?
    let api = new EventEmitter()
    for (const plugin of create.plugins) {
      const pluginConfig = buildPluginConfig(config, plugin)
      let _api = plugin.init.call(
        {},
        api,
        pluginConfig,
        create.permissions,
        create.manifest
      )
      if (plugin.name) {
        const camelCaseName = u.toCamelCase(plugin.name)
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
            if (plugin.manifest && plugin.manifest[key] === 'sync') {
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
     * @param {any} plugin
     */
    function use (plugin) {
      if (Array.isArray(plugin)) {
        plugin.forEach(create.use)
        return create
      }

      if (!plugin.init) {
        if (typeof plugin === 'function') {
          create.plugins.push({ init: plugin })
          return create
        } else {
          throw new Error('plugins *must* have "init" method')
        }
      }

      if (plugin.name && typeof plugin.name === 'string') {
        if (plugin.name === 'global') {
          throw new Error('plugin named "global" is reserved')
        }
        const found = create.plugins.some((p) => p.name === plugin.name)
        if (found) {
          // prettier-ignore
          console.error('plugin named:' + plugin.name + ' is already loaded, skipping')
          return create
        }
      }

      const name = plugin.name

      if (plugin.needs) {
        queueMicrotask(() => {
          for (const needed of plugin.needs) {
            const found = create.plugins.some((p) => p.name === needed)
            if (!found) {
              throw new Error(`secret-stack plugin "${name ?? '?'}" needs plugin "${needed}" but not found`)
            }
          }
        })
      }

      if (plugin.manifest) {
        create.manifest = u.merge.manifest(
          create.manifest,
          plugin.manifest,
          u.toCamelCase(name)
        )
      }
      if (plugin.permissions) {
        create.permissions = u.merge.permissions(
          create.permissions,
          plugin.permissions,
          u.toCamelCase(name)
        )
      }
      create.plugins.push(plugin)

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
