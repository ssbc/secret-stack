
var pull = require('pull-stream')
//a simple flooding protocol
var Illuminati = require('../')
var crypto = require('crypto')
var tape = require('tape')
var u = require('../util')
var seeds = require('./seeds')

var Pushable = require('pull-pushable')

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var create = Illuminati({
  appKey: hash('test_flood')
})
.use({
  manifest: {
    flood: 'source'
  },
  permissions: {
    anonymous: {allow: ['flood']}
  },
  init: function (api) {
    //clients will call flood.
    var messages = {}
    var senders = {}

    function receive(msg) {
      var msg_id = hash(JSON.stringify(msg))
      if(messages[msg_id]) return false
      api.emit('flood:message', msg)
      return messages[msg_id] = msg
    }

    api.on('rpc:connect', function (rpc) {
      pull(
        rpc.flood(),
        pull.drain(function (msg) {
          //broadcast this message,
          //but do not send it back to the person
          //you received it from.
          api.broadcast(msg, this.id)
        })
       )
    })

    return {
      //local
      broadcast: function (msg, id) {
        //never send a message twice.
        if(!receive(msg)) return
        for(var k in senders)
          if(k!== id) senders[k].push(msg)
      },
      flood: function () {
        var id = this.id

        if(senders[id]) senders.abort(true)
        var pushable = senders[id] = Pushable(function () {
          if(senders[id] === pushable)
            delete senders[id]
        })
        for (var k in messages)
          senders[id].push(messages[k])
        return senders[id]
      }
    }
  }
})

function createPeer(name) {
  var alice = create({seed: seeds[name]})
  return alice.on('flood:message', function (msg) {
    console.log(name, 'received', msg)
  })
}

var alice = createPeer('alice')
var bob   = createPeer('bob')
var carol = createPeer('carol')

//for simplicity, we are connecting these manually
//but for extra points, use a gossip protocol, etc!

carol.connect(alice.address(), function (err) {
  if(err) throw err
  alice.connect(bob.address(), function (err) {
    if(err) throw err
    alice.broadcast('Hello!')
    bob.broadcast({okay: true})
  })
})


var i = 10
var int = setInterval(function () {
  //setTimeout(function () {
  var d = new Date()
  if(--i) return carol.broadcast({date: d.toString(), ts: +d})
  clearInterval(int)
  console.log('CLOSE CLOSE CLOSE')
  alice.close(true, function (err) {
    console.log('alice closes')
  })
  bob.close(true, function (err) {
    console.log('bob closes')
  })
  carol.close(true, function (err) {
    console.log('carol closes')
  })

  //}, 200)
}, 100)

