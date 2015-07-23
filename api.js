var EventEmitter = require('events')
var u            = require('./util')
var Hookable     = require('hoox')

function isFunction (f) {
  return 'function' === typeof f
}

function merge (a, b, mapper) {

  for(var k in b) {
    if(b[k] && 'object' === typeof b[k] && !Buffer.isBuffer(b[k]))
      a[k] = merge(a[k], b[k], mapper)
    else
      a[k] = mapper(b[k], k)
  }

  return a
}

module.exports = function (plugins) {

  function create (opts) {
    //change event emitter to something with more rigorous security?
    var api = new EventEmitter()
    create.plugins.forEach(function (plug) {
      var _api = plug.init(api, opts)
      if(plug.name) {
        var o = {}; o[plug.name] = _api; _api = o
      }
      api = merge(api, _api, function (v) {
        return 'function' === typeof v ? Hookable(v) : v
      })

    })

    return api
  }

  create.plugins = []
  create.manifest = {}
  create.permissions = {}

  create.use = function (plug) {
    if(!plug.init)
      throw new Error('plugins *must* have "init" method')

    var name = plug.name
    if(plug.manifest)
      create.manifest =
        u.merge.manifest(create.manifest, plug.manifest, name)
    if(plug.permissions)
      create.permissions =
        u.merge.permissions(create.permissions, plug.permissions, name)
    create.plugins.push(plug)

    return create
  }

  ;[].concat(plugins).filter(Boolean).forEach(create.use)

  return create
}
