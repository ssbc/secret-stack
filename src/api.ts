import * as u from './util'
var EventEmitter = require('events')
var Hookable = require('hoox')

function id<T = any> (e: T): T {
  return e
}

function merge (a: any, b: any, mapper?: any) {
  mapper = mapper || id

  for (var k in b) {
    if (
      b[k] &&
      typeof b[k] === 'object' &&
      !Buffer.isBuffer(b[k]) &&
      !Array.isArray(b[k])
    ) {
      merge((a[k] = {}), b[k], mapper)
    } else {
      a[k] = mapper(b[k], k)
    }
  }

  return a
}

function find (ary: Array<any>, test: Function) {
  var v
  for (var i = 0; i < ary.length; i++) {
    v = test(ary[i], i, ary)
    if (v) return v
  }
  return v
}

export = function Api (plugins: any, defaultConfig: any) {
  function create (opts: any) {
    opts = merge(merge({}, defaultConfig), opts)
    // change event emitter to something with more rigorous security?
    var api = new EventEmitter()
    create.plugins.forEach(function (plug) {
      var _api = plug.init.call(
        {},
        api,
        opts,
        create.permissions,
        create.manifest
      )
      if (plug.name) {
        var o: any = {}
        o[u.toCamelCase(plug.name)] = _api
        _api = o
      }
      api = merge(api, _api, function (v: any, k: any) {
        if (typeof v === 'function') {
          v = Hookable(v)
          if (plug.manifest && plug.manifest[k] === 'sync') {
            u.hookOptionalCB(v)
          }
        }
        return v
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
      if (u.isFunction(plug)) {
        create.plugins.push({ init: plug })
        return create
      } else {
        throw new Error('plugins *must* have "init" method')
      }
    }

    if (u.isString(plug.name)) {
      var found = find(create.plugins, function (_plug: any) {
        return _plug.name === plug.name
      })
      if (found) {
        console.error(
          'plugin named:' + plug.name + ' is already loaded, skipping'
        )
        return create
      }
    }

    var name = plug.name
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
  };
  [].concat(plugins).filter(Boolean).forEach(create.use)

  return create
};
