var Net = require('multiserver/plugins/net')
var nonPrivate = require('non-private-ip')

exports.name = 'multiserver-net'
exports.version = '1.0.0'
exports.mainfest = {}

exports.init = function (ssk, config) {
  ssk.multiserver.transport({
    name: 'net',
    create: function (netConfig) {
      var port = netConfig.port || 1024+(~~(Math.random()*(65536-1024)))
      var host = netConfig.host || nonPrivate.v4 || nonPrivate.private.v4 || '127.0.0.1'

      return Net({host: host, port: port, scope: netConfig.scope, external: netConfig.external})
    }
  })
}
