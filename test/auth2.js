var Illuminati = require('../')
var crypto = require('crypto')
var tape = require('tape')
var u = require('../util')

var seeds = require('./seeds')

var ssbKeys = require('ssb-keys')

var keys = {
  alice: ssbKeys.generate(null, seeds.alice),
  bob: ssbKeys.generate(null, seeds.bob),
  carol: ssbKeys.generate(null, seeds.carol),
}

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey = hash('test_key')

var create = Illuminati({
  appKey: appkey,
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
      if(err) return cb(err)
      console.log("AUTH", id, keys.alice.id)
      if(id === keys.alice.id)
        cb(null, {allow: ['hello', 'aliceOnly']})
      else cb()
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
  alice.connect(bob.getAddress('device') || bob.getAddress(), function (err, bob_rpc) {
    if(err) throw err
    bob_rpc.hello(function (err, data) {
      t.notOk(err)
      t.ok(data)
      bob_rpc.aliceOnly(function (err, data) {
        t.notOk(err)
        t.ok(data)
        bob_rpc.close(function () {
          t.end()
        })
      })
    })
  })
})


tape('server calls client: alice <- bob', function (t) {
  var bob_rpc
  alice.connect(bob.getAddress('device') || bob.getAddress(), function (err, _bob_rpc) {
    if(err) throw err
    bob_rpc = _bob_rpc
  })

  bob.on('rpc:connect', function (alice_rpc) {
    console.log(alice_rpc)
    alice_rpc.hello(function (err, data) {
      t.notOk(err)
      t.ok(data)
      alice_rpc.aliceOnly(function (err, data) {
        t.ok(err)
        t.notOk(data)
        alice_rpc.close(function () {
            t.end()
        })
      })
    })
  })
})

tape('cleanup', function (t) {
  alice.close()
  bob.close()
  carol.close()
  t.end()
})












