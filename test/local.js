var Illuminati = require('../')
var tape = require('tape')
var u = require('../util')

var seeds = require('./seeds')

var appkey = new Buffer(32)

var create = Illuminati({
  appKey: appkey,
})
create.use({
  manifest: {
    ping: 'sync',
  },
  permissions: {
    anonymous: { allow: ['ping'], deny: null }
  },
  init: function (api) {
    return {
      ping: function () {
        return 'pong'
      }
    }
  }
})

var alice = create({
  seed: seeds.alice,
  timeout: 100,
})

tape('do not timeout local client rpc', function (t) {
  alice.connect(alice.address(), function (err, rpc) {
    t.error(err, 'connect')
    setTimeout(function () {
      rpc.ping(function (err, pong) {
        t.error(err, 'ping')
        t.end()
      })
    }, 200)
  })
})

tape.onFinish(function (t) {
  alice.close(true)
})
