var tape = require('tape')
var crypto = require('crypto')
var ssbKeys = require('ssb-keys')
var SecretStack = require('../lib')
var seeds = require('./seeds')

var keys = {
  alice: ssbKeys.generate(null, seeds.alice),
  bob: ssbKeys.generate(null, seeds.bob),
  carol: ssbKeys.generate(null, seeds.carol)
}

// deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey = hash('test_key')

var create = SecretStack({
  appKey: appkey
})

create.use({
  manifest: {
    hello: 'sync',
    aliceOnly: 'sync'
  },
  permissions: {
    anonymous: { allow: ['hello'], deny: null }
  },
  init: function (api) {
    return {
      hello: function (name) {
        return 'Hello, ' + name + '.'
      },
      aliceOnly: function () {
        console.log('alice only')
        return 'hihihi'
      }
    }
  }
})
  .use(function (api) {
    api.auth.hook(function (fn, args) {
      var cb = args.pop()
      var id = args.shift()
      fn(id, function (err, res) {
        if (err) return cb(err)
        console.log('AUTH', id, keys.alice.id)
        if (id === keys.alice.id) { cb(null, { allow: ['hello', 'aliceOnly'] }) } else cb()
      })
    })
  })

var alice = create({
  keys: keys.alice
})

var bob = create({
  keys: keys.bob
})

var carol = create({
  keys: keys.carol
})

tape('bob has address', function (t) {
  setTimeout(function () {
    t.ok(bob.getAddress('device') || bob.getAddress('local'))
    t.end()
  }, 1000)
})

tape('client calls server: alice -> bob', function (t) {
  t.ok(alice.id, 'has local legacy ID')
  t.ok(alice.shs.pubkey, 'has local modern ID')

  alice.connect(bob.getAddress('device') || bob.getAddress(), function (err, bobRpc) {
    if (err) throw err
    t.ok(bobRpc.id, 'has remote legacy ID')
    t.ok(bobRpc.shs.pubkey, 'has remote modern ID')
    bobRpc.hello(function (err, data) {
      t.notOk(err)
      t.ok(data)
      bobRpc.aliceOnly(function (err, data) {
        t.notOk(err)
        t.ok(data)
        bobRpc.close(function () {
          t.end()
        })
      })
    })
  })
})

tape('server calls client: alice <- bob', function (t) {
  alice.connect(bob.getAddress('device') || bob.getAddress(), function (err, _bobRpc) {
    if (err) throw err
  })

  bob.on('rpc:connect', function (aliceRpc) {
    // console.log(aliceRpc)
    aliceRpc.hello(function (err, data) {
      t.notOk(err)
      t.ok(data)
      aliceRpc.aliceOnly(function (err, data) {
        t.ok(err)
        t.notOk(data)
        aliceRpc.close(function () {
          t.end()
        })
      })
    })
  })
})

tape('cleanup', function (t) {
  alice.close(() => {})
  bob.close(() => {})
  carol.close(() => {})
  t.end()
})
