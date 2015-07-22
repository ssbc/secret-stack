
var tape = require('tape')

var merge = require('../util').merge

tape('merge permissions', function (t) {

  var m = merge.permissions({
    anonymous: {allow: [], deny: null}
  }, {
    anonymous: {allow: ['foo']}
  })

  t.deepEqual(m, {anonymous: {allow: ['foo'], deny: null}})

  var m2 = merge.permissions(m, {
    anonymous: {allow: ['baz']}
  }, 'BAR')

  t.deepEqual(m2, {anonymous: {allow: ['foo', 'BAR.baz'], deny: null}})

  t.end()

})

tape('merge manifest', function (t) {

  var m = merge.manifest({
    req: 'async',
    source: 'source',
    sink: 'sink'
  }, {
    more: {
      req: 'async',
      source: 'source',
      sink: 'sink'
    }
  })

  t.deepEqual(m,  {
    req: 'async',
    source: 'source',
    sink: 'sink',
    more: {
      req: 'async',
      source: 'source',
      sink: 'sink'
    }
  })

  var m = merge.manifest({
    req: 'async',
  }, {
    req: 'async',
  }, 'NAME')

  t.deepEqual(m,  {
    req: 'async',
    NAME: {
      req: 'async',
    }
  })

  t.end()

})
