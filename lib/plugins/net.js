// @ts-ignore
const Net = require('multiserver/plugins/net')
const debug = require('debug')('secret-stack net plugin')

/**
 * @typedef {import('../types').Incoming} Incoming
 * @typedef {import('../types').Outgoing} Outgoing
 * @typedef {Incoming | Outgoing} Opts
 */

module.exports = {
  name: 'multiserver-net',
  version: '1.0.0',
  // @ts-ignore
  init (api /** @type {any} */) {
    api.multiserver.transport({
      name: 'net',
      create: (/** @type {Opts}} */ opts) => {
        // prettier-ignore
        debug('creating transport host=%s port=%d scope=%s', opts.host, opts.port, opts.scope)
        return Net(opts) // let multiserver figure out the defaults
      }
    })
  }
}
