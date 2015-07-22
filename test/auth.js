var Illuminati = require('../')
var crypto = require('crypto')
var tape = require('tape')
var u = require('../util')

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var aliceKeys = Illuminati.generate(hash('alice'))
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
.use({
  init: function (api) {
    console.log(api)
    api.auth.hook(function (fn, args) {
      var cb = args.pop()
      var id = args.shift()
      fn(id, function (err, res) {
        if(err) return cb(err)
        if(id === u.toId(aliceKeys.publicKey))
          cb(null, {allow: ['hello', 'aliceOnly']})
        else cb()
      })
    })
  }
})

var alice = create({
  keys: aliceKeys,
})

var bob = create({
  keys: Illuminati.generate(hash('bob')),
})

var carol = create({
  keys: Illuminati.generate(hash('carol')),
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

tape('cleanup', function (t) {
  alice.close(true)
  bob.close(true)
  carol.close(true)
  t.end()
})

