## Secret-Stack Plugins

Secret-Stack provides a minimal core for creating peer-to-peer networks
like Secure-Scuttlebutt. It is highly extensible via plugins.

Plugins are simply NodeJS modules that export an `object` containing
attributes named `init`, `version`, `manifest`, and `name`. A plugin can
also be a `function` that returns this object.

```new-plugin.js
// example plugin format

module.exports = {
  name: 'new-plugin',
  version: require(package.json).version,
  manifest: {},
  init: (ssk, opts) => {}
}
```

Plugins are then added to a `Secret-Stack` instance using the `.use`
method.

```ssk.js
var SecretStack = require('secret-stack')

var create = SecretStack({
  appKey: appKey //32 random bytes
})
.use(require('./new-plugin'))

var node = createApp()
```

The plugin has now been mounted on the `secret-stack` instance and
methods exposed by the plugin can be accessed at
`node.pluginName.methodName`

## Usage

Plugins can be used to for a number of different use cases, like adding
a persistent underlying database
([ssb-db](https://github.com/ssbc/ssb-db')) or layering indexes on top
of the underlying store
([ssb-links](https://github.com/ssbc/ssb-links')).

It becomes very easy to lump a bunch of plugins together and create a
more sophisticated application.

```js
var SecretStack = require('secret-stack')
car config = require('./some-config-file')

var create = SecretStack({
  appKey: appKey //32 random bytes
})
.use(require('ssb-db')) // added persistent log storage
.use(require('ssb-gossip')) // added peer gossip capabilities
.use(require('ssb-replicate')) // can now replicate other logs with
peers
.use(require('ssb-friends')) // which peer's logs should be replicated

var server = create(config) // start application
```


## API

### plugin.init (api, opts)

Each plugin init function is called in the order they where
added and it may return an object which is combined into the api.
if `plugin.name` is a string, then it's added as `api[plugin.name]=plugin.init(api, opts)`
else, it's merged with the api object.

Note, each method on the api gets wrapped with [hoox](https://github.com/dominictarr/hoox)
so that plugins may intercept that function.

### plugin.name

A string that will also be used as the mount point for a plugin. a
plugin's methods with `plugin.name = 'foo'` will be available at `node.foo` on a
`secret-stack` instance.

Names will also be automatically camelCased so `plugin.name = "foo bar"`
will be available at `node.fooBar`.

A `plugin.name` can also be an `'object`. This object will be merged
directly with the

### plugin.manifest

an object containing the mapping of a plugin's exported methods and the
`muxrpc` method type. See the
[muxrpc#manifest](https://github.com/ssbc/muxrpc#manifest) documentation
for more details.

### plugin.version

A plugin's current version number. These generally follow `semver`
guidelines.
