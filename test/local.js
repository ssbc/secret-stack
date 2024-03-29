var tape = require('tape')
var SecretStack = require('../lib')
var seeds = require('./seeds')

var appKey = Buffer.alloc(32)

var create = SecretStack({ global: { appKey } })
create.use({
  manifest: {
    ping: 'sync'
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
  global: {
    seed: seeds.alice,
    timeout: 100
  }
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
