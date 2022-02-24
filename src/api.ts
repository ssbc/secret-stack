import * as u from './util'
const EventEmitter = require('events')
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

export = function Api (plugins: any, defaultConfig: any) {
  function create (inputOpts: any) {
    const opts = merge(merge({}, defaultConfig), inputOpts)
    // change event emitter to something with more rigorous security?
    let api = new EventEmitter()
    create.plugins.forEach((plug) => {
      let _api = plug.init.call(
        {},
        api,
        opts,
        create.permissions,
        create.manifest
      )
      if (plug.name) {
        const camelCaseName = u.toCamelCase(plug.name)
        const o: any = {}
        o[camelCaseName] = _api
        _api = o
      }
      api = merge(api, _api, (val: any, key: any) => {
        if (typeof val === 'function') {
          val = Hookable(val)
          if (plug.manifest && plug.manifest[key] === 'sync') {
            u.hookOptionalCB(val)
          }
        }
        return val
      })
    })
    return api
  }

  create.plugins = [] as Array<any>
  create.manifest = {}
  create.permissions = {}

  create.use = function (plug: any) {
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
      const found = create.plugins.some((p) => p.name === plug.name)
      if (found) {
        console.error(
          'plugin named:' + plug.name + ' is already loaded, skipping'
        )
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

    // merge top level permissions with plugin's permissions
    if (plug.permissions) {
      create.permissions = u.merge.permissions(
        create.permissions,
        plug.permissions,
        u.toCamelCase(name)
      )
    }

    create.plugins.push(plug)

    return create
  };

  [].concat(plugins).filter(Boolean).forEach(create.use)

  return create
};
