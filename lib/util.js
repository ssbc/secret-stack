// @ts-ignore
const mapMerge = require('map-merge')
const camelize = require('to-camel-case')

/**
 * @param {any} x
 * @return {x is Record<string, unknown>}
 */
function isObject (x) {
  return !!x && typeof x === 'object'
}

/**
 * @param {any} x
 * @return {x is number}
 */
function isNumber (x) {
  return typeof x === 'number' && !isNaN(x)
}

/**
 * @param {unknown} obj
 * @param {any} mapper
 * @return {any}
 */
function clone (obj, mapper) {
  /**
   * @param {unknown} v
   * @param {string | number} [k]
   */
  function map (v, k) {
    return isObject(v) ? clone(v, mapper) : mapper(v, k)
  }

  if (Array.isArray(obj)) {
    return obj.map(map)
  } else if (isObject(obj)) {
    /** @type {any} */
    const o = {}
    for (const k in obj) {
      o[k] = map(obj[k], k)
    }
    return o
  } else {
    return map(obj)
  }
}

/**
 * @param {Buffer | string} pub
 * @return {string}
 */
function toId (pub) {
  return Buffer.isBuffer(pub) ? pub.toString('base64') + '.ed25519' : pub
}

const merge = {
  /**
   * @param {unknown} perms
   * @param {unknown} _perms
   * @param {string=} name
   */
  permissions (perms, _perms, name) {
    return mapMerge(
      perms,
      clone(_perms, (/** @type {any} */ v) => (name ? name + '.' + v : v))
    )
  },

  /**
   * @param {unknown} manf
   * @param {unknown} _manf
   * @param {string=} name
   */
  manifest (manf, _manf, name) {
    if (name) {
      /** @type {any} */
      const o = {}
      o[name] = _manf
      _manf = o
    }
    return mapMerge(manf, _manf)
  }
}

/**
 * @param {any} syncFn
 */
function hookOptionalCB (syncFn) {
  // syncFn is a function that's expected to return its result or throw an error
  // we're going to hook it so you can optionally pass a callback
  syncFn.hook(
    /**
     * @this {unknown}
     * @param {Function} fn
     * @param {Array<unknown>} args
     */
    function (fn, args) {
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
    }
  )
}

/**
 * @param {string | undefined} n
 * @return {string | undefined}
 */
function toCamelCase (n) {
  return n ? camelize(n) : n
}

module.exports = {
  isObject,
  isNumber,
  clone,
  toId,
  merge,
  hookOptionalCB,
  toCamelCase
}
