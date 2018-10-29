var tape = require('tape')
var Api  = require('../api')

tape('add a core api + a plugin', function (t) {

  var Create = Api([{
    init: function (api, opts) {
      t.deepEqual(opts, {okay: true})
      return {
        hello: function (name) {
          return 'Hello, ' + name + '.'
        }
      }
    }
  }])

  var api = Create({okay: true})

  t.equal(api.hello('Foo'), 'Hello, Foo.')

  Create.use({
    init: function (api, opts) {
      t.deepEqual(opts, {okay: true})
      api.hello.hook(function (greet, args) {
        var value = greet(args[0])
        return value.substring(0, value.length - 1) + '!!!'
      })
    }
  })

  var api2 = Create({okay: true})
  t.equal(api2.hello('Foo'), 'Hello, Foo!!!')
  t.end()
})

tape('named plugin', function (t) {

  //core, not a plugin.
  var Create = Api([{
    manifest: {
      hello: 'sync'
    },
    init: function (api) {
      return {
        hello: function (name) {
          return 'Hello, ' + name + '.'
        }
      }
    }
  }])

  console.log(Create)

  Create.use({
    name: 'foo',
    manifest: {
      goodbye: 'async'
    },
    init: function () {
      return {goodbye: function (n, cb) { cb(null, n) }}
    }
  })

  t.deepEqual(Create.manifest, {
    hello: 'sync',
    foo: {
      goodbye: 'async'
    }
  })

  t.end()
})


tape('camel-case plugin', function (t) {

  //core, not a plugin.
  var Create = Api([{
    manifest: {},
    init: function (api) {
      return {}
    }
  }])

  console.log(Create)

  Create.use({
    name: 'foo-bar',
    manifest: {
      goodbye: 'async'
    },
    init: function () {
      return {goodbye: function (n, cb) { cb(null, n) }}
    }
  })

  t.deepEqual(Create.manifest, {
    fooBar: {
      goodbye: 'async'
    }
  })

  t.end()
})


tape('optional cb hook for sync api methods', function (t) {

  //core, not a plugin.
  var Create = Api([{
    manifest: {
      hello: 'sync'
    },
    init: function (api) {
      return {
        hello: function (name) {
          return 'Hello, ' + name + '.'
        }
      }
    }
  }])

  console.log(Create)

  Create.use({
    name: 'foo',
    manifest: {
      goodbye: 'sync'
    },
    init: function () {
      return {
        goodbye: function (n) { 
          if (n === 0)
            throw "bad input!"
          return n
        }
      }
    }
  })

  var api = Create({okay: true})

  // sync usages
  t.equal(api.hello('Foo'), 'Hello, Foo.')
  t.equal(api.foo.goodbye(5), 5)
  try {
    api.foo.goodbye(0)
    t.fail('should have thrown')
  } catch (e) {
    t.ok(e)
  }

  // async usages
  api.hello('Foo', function (err, res) {
    if (err) throw err      
    t.equal(res, 'Hello, Foo.')

    api.foo.goodbye(5, function (err, res) {
      if (err) throw err      
      t.equal(res, 5)

      api.foo.goodbye(0, function (err) {
        t.ok(err)
        t.end()
      })
    })
  })
})

