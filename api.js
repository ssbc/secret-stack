var EventEmitter = require('events')
var u = require('./util')
var Hookable = require('hoox')

function id (e) {
  return e
}

function merge (a, b, mapper) {
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

function find (ary, test) {
  var v
  for (var i = 0; i < ary.length; i++) {
    v = test(ary[i], i, ary)
    if (v) return v
  }
  return v
}

module.exports = function (plugins, defaultConfig) {
  function create (opts) {
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
        var o = {}
        o[u.toCamelCase(plug.name)] = _api
        _api = o
      }
      api = merge(api, _api, function (v, k) {
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

  create.plugins = []
  create.manifest = {}
  create.permissions = {}

  create.use = function (plug) {
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
      var found = find(create.plugins, function (_plug) {
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
  }

  ;[].concat(plugins).filter(Boolean).forEach(create.use)

  return create
}
