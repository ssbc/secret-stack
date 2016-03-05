var Illuminati = require('../')
var crypto = require('crypto')
var tape = require('tape')
var u = require('../util')

var seeds = require('./seeds')

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey1 = hash('test_key1')
var appkey2 = hash('test_key2')

var create = Illuminati({})

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
      if(id === '@'+u.toId(alice.publicKey))
        cb(null, {allow: ['hello', 'aliceOnly']})
      else cb()
    })
  })
})

var alice = create({
  seed: seeds.alice, appKey: appkey1
})

var bob = create({
  seed: seeds.bob, appKey: appkey1
})

var carol = create({
  seed: seeds.carol, appKey: appkey1
})

tape('alice *can* use alice_only api', function (t) {
  alice.connect(bob.address(), function (err, rpc) {
    if(err) throw err
    rpc.aliceOnly(function (err, data) {
      if(err) throw err
      t.equal(data, 'hihihi')
      t.end()
    })
  })
})

tape('carol *cannot* use alice_only api', function (t) {
  carol.connect(bob.address(), function (err, rpc) {
    if(err) throw err
    rpc.aliceOnly(function (err, data) {
      t.ok(err)
      t.end()
    })
  })
})


var antialice = create({
  seed: seeds.alice, appKey: appkey2
})

var antibob = create({
  seed: seeds.bob, appKey: appkey2
})

tape('antialice cannot connect to alice because they use different appkeys', function (t) {
  antialice.connect(alice.address(), function (err, rpc) {
    t.ok(err)
    t.end()
  })
})


tape('antialice can connect to antibob because they use the same appkeys', function (t) {
  antialice.connect(antibob.address(), function (err, rpc) {
    t.notOk(err)
    t.end()
  })
})


tape('cleanup', function (t) {
  alice.close(true)
  antialice.close(true)
  bob.close(true)
  antibob.close(true)
  carol.close(true)
  t.end()
})




