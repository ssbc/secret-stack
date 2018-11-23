var Net = require('multiserver/plugins/net')
var nonPrivate = require('non-private-ip')
var debug = require('debug')('secret-stack net plugin')

exports.name = 'multiserver-net'
exports.version = '1.0.0'
exports.manifest = {}

exports.init = function (ssk, config) {
  ssk.multiserver.transport({
    name: 'net',
    create: function (opts) {
      debug('creating transport host=%s port=%d scope=%s', opts.host, opts.port, opts.scope)
      // let multiserver figure out the defaults
      return Net(opts)
    }
  })
}
