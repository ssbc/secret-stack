var tape = require('tape')
var crypto = require('crypto')
var SecretStack = require('../src')
var seeds = require('./seeds')

// deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey = hash('test_key')

var create = SecretStack({
  appKey: appkey
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

var alice = create({ seed: seeds.alice })
var bob = create({ seed: seeds.bob })

tape('alice connects to bob', function (t) {
  alice.connect(bob.address(), function (err, rpc) {
    if (err) throw err

    rpc.hello('Alice', function (err, data) {
      if (err) throw err
      t.equal(data, 'Hello, Alice.')
      // alice.close(true); bob.close(true)
      console.log(data)
      t.end()
    })
  })
})

tape('alice is client, bob is server', function (t) {
  t.plan(4)

  alice.on('rpc:connect', function (rpc, isClient) {
    t.true(rpc.stream.address.substr(0, 4) === 'net:' && rpc.stream.address.length > 40)
    t.ok(isClient)
  })
  bob.on('rpc:connect', function (rpc, isClient) {
    t.true(rpc.stream.address.substr(0, 4) === 'net:' && rpc.stream.address.length > 40)
    t.notOk(isClient)
  })

  alice.connect(bob.address(), function () {})
})

tape('cleanup', function (t) {
  alice.close(true); bob.close(true)
  t.end()
})
