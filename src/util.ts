var isArray = Array.isArray
var mapMerge = require('map-merge')
var camelize = require('to-camel-case')

function isObject (o: any) {
  return o && typeof o === 'object'
}

export function clone (obj: any, mapper: any): any {
  function map (v: any, k?: string | number) {
    return isObject(v) ? clone(v, mapper) : mapper(v, k)
  }
  if (isArray(obj)) {
    return obj.map(map)
  } else if (isObject(obj)) {
    var o: any = {}
    for (var k in obj) {
      o[k] = map(obj[k], k)
    }
    return o
  } else {
    return map(obj)
  }
}

export function toId (pub: Buffer | string) {
  return Buffer.isBuffer(pub) ? pub.toString('base64') + '.ed25519' : pub
}

export var merge = {
  permissions: function (perms: any, _perms: any, name?: string) {
    return mapMerge(
      perms,
      clone(_perms, function (v: any) {
        return name ? name + '.' + v : v
      })
    )
  },
  manifest: function (manf: any, _manf: any, name?: string) {
    if (name) {
      var o: any = {}
      o[name] = _manf
      _manf = o
    }
    return mapMerge(manf, _manf)
  }
}

export function hookOptionalCB (syncFn: any) {
  // syncFn is a function that's expected to return its result or throw an error
  // we're going to hook it so you can optionally pass a callback
  syncFn.hook(function (this: any, fn: any, args: Array<any>) {
    // if a function is given as the last argument, treat it as a callback
    var cb = args[args.length - 1]
    if (typeof cb === 'function') {
      var res
      args.pop() // remove cb from the arguments
      try {
        res = fn.apply(this, args)
      } catch (e) {
        return cb(e)
      }
      cb(null, res)
    } else {
      // no cb provided, regular usage
      return fn.apply(this, args)
    }
  })
}

export function toCamelCase (n: string | undefined | null) {
  return n ? camelize(n) : n
}

export function isFunction (f: any): f is CallableFunction {
  return typeof f === 'function'
}

export function isString (s: any): s is string {
  return s && typeof s === 'string'
}
