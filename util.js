var isArray = Array.isArray
var merge        = require('map-merge')

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
