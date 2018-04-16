var Illuminati = require('../')
var crypto = require('crypto')
var tape = require('tape')
var seeds = require('./seeds')

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey = hash('test_key')

var create = Illuminati({
  appKey: appkey,
}).use({
  manifest: {
    hello: 'sync'
  },
  permissions: {
    anonymous: { allow: ['hello'], deny: null }
  },
  init: function (api) {
    return {
      hello: function (name) {
        return 'Hello, ' + name + '.'
      }
    }
  }
})

var alice = create({ seed: seeds.alice, timeout: 200, defaultTimeout: 5e3 })
var carol = create({ seed: seeds.alice, timeout: 0, defaultTimeout: 10 })
var bob = create({ seed: seeds.bob , timeout: 200, defaultTimeout: 2000})

tape('delay startup', function (t) {
  setTimeout(t.end, 500)
})

tape('alice connects to bob', function (t) {

  var connected = false, disconnected = false

  alice.connect(bob.address(), function (err, rpc) {
    if(err) throw err
    var start = Date.now()
    rpc.on('closed', function () {
      console.log('time to close:', Date.now() - start)
      t.ok(connected)
      t.notOk(disconnected)
      t.end()
    })
  })

  carol.connect(bob.address(), function (err, rpc) {
    connected = true
    carol.on('closed', function (t) {
      disconnected = true
    })
  })

})

tape('cleanup', function (t) {
  alice.close(true); bob.close(true); carol.close(true)
  t.end()
})


