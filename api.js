var EventEmitter = require('events')
var u            = require('./util')
var Hookable     = require('hoox')
var camelize     = require('to-camel-case')

function toCamelCase (n) {
  return n ? camelize(n) : n
}

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return s && 'string' === typeof s
}

function id (e) { return e }

function merge (a, b, mapper) {

  mapper = mapper || id

  for(var k in b) {
    if(b[k] && 'object' === typeof b[k] && !Buffer.isBuffer(b[k]) && !Array.isArray(b[k]))
      merge(a[k] = {}, b[k], mapper)
    else
      a[k] = mapper(b[k], k)
  }

  return a
}

function find(ary, test) {
  var v
  for(var i = 0; i < ary.length; i++)
    if(v = test(ary[i], i, ary)) return v
  return v
}

module.exports = function (plugins, defaults) {

  function create (opts) {
    opts = merge(merge({}, defaults), opts)
    //change event emitter to something with more rigorous security?
    var api = new EventEmitter()
    create.plugins.forEach(function (plug) {
      var _api = plug.init.call({createClient: create.createClient}, api, opts, create.permissions, create.manifest)
      if(plug.name) {
        var o = {}; o[toCamelCase(plug.name)] = _api; _api = o
      }
      api = merge(api, _api, function (v, k) {
        if ('function' === typeof v) {
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
    if(isFunction(plug))
      return create.plugins.push({init: plug}), create

    if(!plug.init)
      throw new Error('plugins *must* have "init" method')

    if(isString(plug.name))
      if(find(create.plugins, function (_plug) {
        return _plug.name === plug.name
      }))
        throw new Error('plugin named:'+plug.name+' is already loaded')

    var name = plug.name
    if(plug.manifest)
      create.manifest =
        u.merge.manifest(create.manifest, plug.manifest, toCamelCase(name))
    if(plug.permissions)
      create.permissions =
        u.merge.permissions(create.permissions, plug.permissions, toCamelCase(name))
    create.plugins.push(plug)

    return create
  }

  ;[].concat(plugins).filter(Boolean).forEach(create.use)

  return create
}

