var isArray = Array.isArray
var merge   = require('map-merge')

function isObject (o) {
  return o && 'object' === typeof o
}

function isString (s) {
  return 'string' === typeof s
}

var clone = exports.clone = function clone (obj, mapper) {
  function map(v, k) {
    return isObject(v) ? clone(v, mapper) : mapper(v, k)
  }
  if(isArray(obj))
    return obj.map(map)
  else if(isObject(obj)) {
    var o = {}
    for(var k in obj)
      o[k] = map(obj[k], k)
    return o
  }
  else
    return map(obj)
}

exports.parseAddress = function (e) {
  if(isString(e)) {
    var parts = e.split(':')
    var e = {
      host: parts[0],
      port: +parts[1],
      key: fromId(parts[2])
    }
    return e
  }
  return e
}

var fromId = exports.fromId = function (id) {
  return new Buffer(id.substring(0, id.indexOf('.')), 'base64')
}

exports.toId = function (pub) {
  return Buffer.isBuffer(pub) ? pub.toString('base64')+'.ed25519' : pub
}

exports.merge = {
  permissions: function (perms, _perms, name) {
    return merge(perms,
      clone(_perms, function (v) {
        return name ? name + '.' + v : v
      })
    )

  },
  manifest: function (manf, _manf, name) {
    if(name) {
      var o = {}; o[name] = _manf; _manf = o
    }
    return merge(manf, _manf)
  }
}

exports.hookOptionalCB = function (syncFn) {
  // syncFn is a function that's expected to return its result or throw an error
  // we're going to hook it so you can optionally pass a callback
  syncFn.hook(function(fn, args) {
    // if a function is given as the last argument, treat it as a callback
    var cb = args[args.length - 1]
    if (typeof cb == 'function') {
      var res
      args.pop() // remove cb from the arguments
      try { res = fn.apply(this, args) }
      catch (e) { return cb(e) }
      cb(null, res)
    } else {
      // no cb provided, regular usage
      return fn.apply(this, args)
    }
  })
}
