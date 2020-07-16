const mapMerge = require('map-merge')
const camelize = require('to-camel-case')

function isObject (o: unknown): o is Record<string, unknown> {
  return o && typeof o === 'object'
}

export function clone (obj: unknown, mapper: any): any {
  function map (v: unknown, k?: string | number) {
    return isObject(v) ? clone(v, mapper) : mapper(v, k)
  }
  if (Array.isArray(obj)) {
    return obj.map(map)
  } else if (isObject(obj)) {
    const o: any = {}
    for (const k in obj) {
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

export const merge = {
  permissions (perms: unknown, _perms: unknown, name?: string) {
    return mapMerge(
      perms,
      clone(_perms, (v: any) => name ? name + '.' + v : v)
    )
  },
  manifest (manf: unknown, _manf: unknown, name?: string) {
    if (name) {
      const o: any = {}
      o[name] = _manf
      _manf = o
    }
    return mapMerge(manf, _manf)
  }
}

export function hookOptionalCB (syncFn: any) {
  // syncFn is a function that's expected to return its result or throw an error
  // we're going to hook it so you can optionally pass a callback
  syncFn.hook(function (this: unknown, fn: Function, args: Array<unknown>) {
    // if a function is given as the last argument, treat it as a callback
    const cb = args[args.length - 1]
    if (typeof cb === 'function') {
      let res
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
