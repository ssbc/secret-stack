import * as u from './util'
import { Create, Plugin } from './types'
import EventEmitter = require('events')
const Hookable = require('hoox')

const identity = (x: unknown): unknown => x

function merge (a: any, b: any, mapper?: any) {
  mapper = mapper ?? identity
  for (const k in b) {
    if (
      b[k] &&
      typeof b[k] === 'object' &&
      !Buffer.isBuffer(b[k]) &&
      !Array.isArray(b[k])
    ) {
      a[k] = {}
      merge(a[k], b[k], mapper)
    } else {
      a[k] = mapper(b[k], k)
    }
  }
  return a
}

export = function Api (providedPlugins: unknown, defaultConfig: unknown) {
  if (!Array.isArray(providedPlugins)) {
    throw new Error('initial plugins must be provided in an array')
  }
  const initialPlugins = (providedPlugins as Array<unknown>).filter(Boolean)

  const create: Create<{}> = function create (inputOpts: unknown) {
    const opts = merge(merge({}, defaultConfig), inputOpts)
    // change event emitter to something with more rigorous security?
    let totalApi = new EventEmitter()
    create.plugins.forEach((plugin) => {
      let pluginApi = plugin.init.call(
        {},
        totalApi,
        opts,
        create.permissions,
        create.manifest
      )
      if (plugin.name) {
        const camelCaseName = u.toCamelCase(plugin.name)
        const obj: Record<string, unknown> = {}
        obj[camelCaseName] = pluginApi
        pluginApi = obj
      }
      totalApi = merge(totalApi, pluginApi, (val: unknown, key: string) => {
        if (typeof val === 'function') {
          val = Hookable(val)
          if (plugin.manifest && plugin.manifest[key] === 'sync') {
            u.hookOptionalCB(val)
          }
        }
        return val
      })
    })
    return totalApi
  }

  create.plugins = []
  create.manifest = {}
  create.permissions = {}

  create.use = function (plugin: unknown) {
    if (Array.isArray(plugin)) {
      plugin.forEach(create.use)
      return create
    }

    if (!(plugin as Partial<Plugin>).init) {
      if (typeof plugin === 'function') {
        const init = plugin as Plugin['init']
        create.plugins.push({ init })
        return create
      } else {
        throw new Error('plugins *must* have "init" method')
      }
    }

    const maybePlugin = plugin as Plugin
    if (maybePlugin.name && typeof maybePlugin.name === 'string') {
      const found = create.plugins.some((p) => p?.name === maybePlugin.name)
      if (found) {
        console.error(
          `plugin named "${maybePlugin.name}" is already loaded, skipping it`
        )
        return create
      }
    }

    const camelCaseName = u.toCamelCase(maybePlugin.name)
    if (maybePlugin.manifest) {
      create.manifest = u.merge.manifest(
        create.manifest,
        maybePlugin.manifest,
        camelCaseName
      )
    }
    if (maybePlugin.permissions) {
      create.permissions = u.merge.permissions(
        create.permissions,
        maybePlugin.permissions,
        camelCaseName
      )
    }
    create.plugins.push(maybePlugin)

    return create
  }

  initialPlugins.forEach(create.use)

  return create
};
