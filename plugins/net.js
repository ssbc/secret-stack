
var Net = require('multiserver/plugins/net')
var nonPrivate = require('non-private-ip')

exports.name = 'multiserver-net'
exports.version = '1.0.0'
exports.mainfest = {}

exports.init = function (ssk, config) {
  var port = config.port || 1024+(~~(Math.random()*(65536-1024)))
  var host = config.host || nonPrivate.v4 || nonPrivate.private.v4 || '127.0.0.1'

  ssk.multiserver.transport(function (instance) {
    return Net({host: config.host, port: config.port+instance || port})
  })
}

