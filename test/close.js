var crypto = require('crypto')
var SecretStack = require('../src')
var seeds = require('./seeds')

// deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var create = SecretStack({
  appKey: hash('test_flood'),
  permissions: {
    anonymous: { allow: null }
  }
})
  .use({
    manifest: {
      testSource: 'source'
    },
    init: function () {
      return {
        testSource: function (abort, cb) {

        }
      }
    }
  })
function createPeer (name) {
  var alice = create({ seed: seeds[name] })
  return alice.on('flood:message', function (msg) {
    console.log(name, 'received', msg)
  })
}

var alice = createPeer('alice')
var bob = createPeer('bob')
var carol = createPeer('carol')

bob.connect(alice.address(), function (err, rpc) {
  if (err) throw err
  var n = 2
  rpc.testSource()
  rpc.once('closed', next)
  alice.connect(carol.address(), function (err, rpc) {
    if (err) throw err
    rpc.once('closed', next)
    alice.close(true)
    rpc.testSource()
  })

  function next () {
    if (--n) return
    console.log('closed')
    alice.close()
    bob.close()
    carol.close()
  }
})
