## Secret-Stack Plugins

Secret-Stack provides a minimal core for creating peer-to-peer networks
like Secure-Scuttlebutt. It is highly extensible via plugins.

## Example Usage

Plugins are simply NodeJS modules that export an `object` of form `{ name, version, manifest, init }`.

```js
// bluetooth-plugin.js

module.exports = {
  name: 'bluetooth',
  needs: ['conn'],
  version: '5.0.1',
  manifest: {
    localPeers: 'async',
    updates: 'source'
  },
  init: (api, opts) => {
    // .. do things

    // In opts, only opts.bluetooth and opts.global are available

    // return things promised by the manifest:
    return {
      localPeers, // an async function (takes a callback)
      updates // a function which returns a pull-stream source
    }
  }
}
```

Plugins are then added to a `Secret-Stack` instance using the `.use`
method.

```js
// index.js

var SecretStack = require('secret-stack')

var App = SecretStack({ global: { appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=' } })
  .use(require('./bluetooth-plugin'))

var app = App()
```

The plugin has now been mounted on the `secret-stack` instance and
methods exposed by the plugin can be accessed at `app.pluginName.methodName`
(e.g. `app.bluetooth.updates`)

---

Plugins can be used to for a number of different use cases, like adding
a persistent underlying database ([ssb-db](https://github.com/ssbc/ssb-db'))
or layering indexes on top of the underlying store ([ssb-links](https://github.com/ssbc/ssb-links)).

It becomes very easy to lump a bunch of plugins together and create a
more sophisticated application.

```js
var SecretStack = require('secret-stack')
var config = require('./some-config-file')

var Server = SecretStack({ global: { appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=' } })
  .use(require('ssb-db')) // added persistent log storage
  .use(require('ssb-gossip')) // added peer gossip capabilities
  .use(require('ssb-replicate')) // can now replicate other logs with peers
  .use(require('ssb-friends')) // which peer's logs should be replicated

var server = Server(config) // start application
```

## Plugin Format

A valid plugin is an `Object` of form `{ name, version, manifest, init }`

### `plugin.name` (String)

A string that will also be used as the mount point for a plugin. a
plugin's methods with `plugin.name = 'foo'` will be available at `node.foo` on a
`secret-stack` instance.

Names will also be automatically camelCased so `plugin.name = "foo bar"`
will be available at `node.fooBar`.

A `plugin.name` can also be an `'object`. This object will be merged
directly with the

### `plugin.needs` (Array) _optional_

An array of strings which are the names of other plugins that this plugin
depends on. If those plugins are not present, then secret-stack will throw
an error indicating that the dependency is missing.

Use this field to declare dependencies on other plugins, and this should
facilitate the correct usage of your plugin.

### `plugin.version` (String) _optional_

NOTE - not currently used anywhere functionally

A plugin's current version number. These generally follow `semver`
guidelines.

### `plugin.init(api, opts, permissions, manifest)` (Function)

When the secret-stack app is instantiated/ created, all init functions
of plugins will be called in the order they were registered with `use`.

The `init` function of a plugin will be passed:
- `api` - _Object_ the secret-stack app so far
- `opts` - configurations available to this plugin are `opts.global` and `opts[plugin.name]`
- `permissions` - _Object_ the permissions so far
- `manifest` - _Object_ the manifest so far

If `plugin.name` is a string, then the return value of init is mounted like `api[plugin.name] = plugin.init(api, opts)`

(If there's no `plugin.name` then the results of `init` are merged directly with the `api` object!)

Note, each method on the api gets wrapped with [hoox](https://github.com/dominictarr/hoox)
so that plugins may intercept that function.

### `plugin.manifest` (Object)

An object containing the mapping of a plugin's exported methods and the
`muxrpc` method type. See the
[muxrpc#manifest](https://github.com/ssbc/muxrpc#manifest) documentation
for more details.


### `plugin.permissions` (Object) _optional_

Any permissions provided will be merged into the main permissions,
prefixed with the plugin name.

e.g. In this case we're giving anyone access to `api.bluetooth.localPeers`,
and the permission would be listed `'bluetooth.localPeers'`

```js
module.exports = {
  name: 'bluetooth',
  version: '5.0.1',
  manifest: {
    localPeers: 'async',
    updates: 'source'
  },
  permissions: {
    anonymous: [ 'localPeers' ]
  },
  init: (api, opts) => {
    // .. do things

    // return things promised by the manifest:
    return {
      localPeers, // an async function (takes a callback)
      updates // a function which returns a pull-stream source
    }
  }
}
```


## Deprecated Plugin Format

A plugin can also be a function which returns an object.
This is not currently recommended, as it's less clear to readers what the outcome is.

