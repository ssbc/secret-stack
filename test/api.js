var tape = require('tape')
var Api = require('../lib/api')

tape('add a core api + a plugin', function (t) {
  var Create = Api([{
    init: function (api, opts) {
      t.deepEqual(opts, { global: { okay: true } })
      return {
        hello: function (name) {
          return 'Hello, ' + name + '.'
        }
      }
    }
  }])

  var api = Create({ global: { okay: true } })

  t.equal(api.hello('Foo'), 'Hello, Foo.')

  Create.use({
    init: function (api, opts) {
      t.deepEqual(opts, { global: { okay: true } })
      api.hello.hook(function (greet, args) {
        var value = greet(args[0])
        return value.substring(0, value.length - 1) + '!!!'
      })
    }
  })

  var api2 = Create({ global: { okay: true } })
  t.equal(api2.hello('Foo'), 'Hello, Foo!!!')
  t.end()
})

tape('named plugin', function (t) {
  // core, not a plugin.
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

  // console.log(Create)

  Create.use({
    name: 'foo',
    manifest: {
      goodbye: 'async'
    },
    init: function () {
      return { goodbye: function (n, cb) { cb(null, n) } }
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
  // core, not a plugin.
  var Create = Api([{
    manifest: {},
    init: function (api) {
      return {}
    }
  }])

  // console.log(Create)

  Create.use({
    name: 'foo-bar',
    manifest: {
      goodbye: 'async'
    },
    init: function () {
      return { goodbye: function (n, cb) { cb(null, n) } }
    }
  })

  t.deepEqual(Create.manifest, {
    fooBar: {
      goodbye: 'async'
    }
  })

  t.end()
})

tape('plugin cannot read other plugin config', function (t) {
  t.plan(2)
  // core, not a plugin.
  var Create = Api([{
    init: () => {}
  }])

  Create.use({
    name: 'foo',
    init(api, config) {
      t.deepEqual(config.foo, { x: 10 })
      t.notOk(config.bar)
      return { }
    }
  })

  Create({
    foo: { x: 10 },
    bar: { y: 20 }
  })
})

tape('plugin cannot be named global', function (t) {
  // core, not a plugin.
  var Create = Api([{
    manifest: {},
    init: function (api) {
      return {}
    }
  }])

  t.throws(() => {
    Create.use({
      name: 'global',
      init: function () { }
    })
  }, 'throws on global plugin')

  t.end()
})

tape('plugin needs another plugin', function (t) {
  // core, not a plugin.
  var Create = Api([{
    manifest: {},
    init: function (api) {
      return {}
    }
  }])

  function uncaughtExceptionListener(err) {
    t.equals(err.message, 'secret-stack plugin "x" needs plugin "y" but not found')

    // Wait for potentially other errors
    setTimeout(() => {
      process.off('uncaughtException', uncaughtExceptionListener)
      t.end()
    }, 100)
  }

  process.on('uncaughtException', uncaughtExceptionListener)

  // Should throw
  Create.use({
    name: 'x',
    needs: ['y'],
    init: function () { }
  })

  // Should NOT throw, even though 'foo' is loaded after 'bar'
  Create.use({
    name: 'bar',
    needs: ['foo'],
    init: function () { }
  })

  Create.use({
    name: 'foo',
    init: function () { }
  })
})

tape('compound (array) plugins', function (t) {
  // core, not a plugin.
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

  // console.log(Create)

  Create.use([
    {
      name: 'foo',
      manifest: {
        goodbye: 'async'
      },
      init: function () {
        return { goodbye: function (n, cb) { cb(null, n) } }
      }
    }, {
      name: 'bar',
      manifest: {
        farewell: 'async'
      },
      init: function () {
        return { farewell: function (n, cb) { cb(null, n) } }
      }
    }
  ])

  t.deepEqual(Create.manifest, {
    hello: 'sync',
    foo: {
      goodbye: 'async'
    },
    bar: {
      farewell: 'async'
    }
  })

  t.end()
})

tape('optional cb hook for sync api methods', function (t) {
  // core, not a plugin.
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

  // console.log(Create)

  Create.use({
    name: 'foo',
    manifest: {
      goodbye: 'sync'
    },
    init: function () {
      return {
        goodbye: function (n) {
          if (n === 0) { throw new Error('bad input!') }
          return n
        }
      }
    }
  })

  var api = Create({ okay: true })

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
