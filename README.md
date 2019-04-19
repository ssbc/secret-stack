# secret-stack

create secure peer to peer networks using secret-handshakes.

SecretStack is built on [secret-handshake](https://github.com/dominictarr/secret-handshake)
and [muxrpc](https://github.com/ssbc/muxrpc). This provides a framework
to make building secure, decentralized systems easier.
(such as [scuttlebot](https://github.com/ssbc/scuttlebot) which this was refactored out of ;)

## Example

``` js
var SecretStack = require('secret-stack')
var databasePlugin = require('./some-database')
var bluetoothPlugin = require('./bluetooth')
var config = require('./some-config')

var App = SecretStack({ appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=' })
  .use(databasePlugin)
  .use(bluetoothPlugin)

vap app = App(config)
```

For documentation on plugins, see [PLUGINS.md](./PLUGINS.md) 


## API

### `SecretStack(opts) => App`

Initialize a new app factory.

`opts` is an Object with properties:
- `appKey` - _String, 32 bytes_ a high entropy (i.e. random) key which is fixed for your app. Actors who do not know this value will not be able to connect to instances of your app.
- `permissions` - _Object_ (optional), you can set default permissions which will be the foundation for all permissions subsequently added

NOTE - you can also add other properties to opts. These will be merged with `config` later to form the final config passed to each plugin. (i.e. `merge(opts, config)`)


### `App.use(plugin) => App`

Add a plugin to the factory. See [PLUGINS.md](PLUGINS.md) for more details.

Returns the App (with plugin now installed)

### `App(config) => app`

Start the app and returns an EventEmitter with methods (core and plugin) attached.

`config` is an (optional) Object with any properties:
- `keys` - _String_ a sodium ed25519 key pair
- ... - (optional)

`config` will be passed to each plugin as they're initialised (as `merge(opts, config)` which opts were those options `SecretStack` factory was initialised with).

### app.getAddress()

get a string representing the address of this node.
it will be `ip:port:<base64:pubkey>`.

### app.connect(address, cb)

create a rpc connection to another instance.
Address should be the form returned by `getAddress`

### app.auth(publicKey, cb)

Query what permissions a given public key is assigned.
it's not intended for this to be exposed over the network,
but rather to extend this method to create plugable permissions systems.

``` js
app.auth.hook(function (auth, args) {
  var pub = args[0]
  var cb = args[1]
  //call the first auth fn, and then hook the callback.
  auth(pub, function (err, perms) {
    if(err)  cb(err)
    //optionally set your own perms for this pubkey.
    else if(accepted)
       cb(null, permissions)

    //or if you wish to reject them
    else if(rejected)
      cb(new Error('reject'))

    //fallback to default (the next hook, or the anonymous config, if defined)
    else
      cb()
  })
})
```

### `app.close()`

close the app!

Optionally takes `(err, callback)`

----

## TODO document

> mix: I think some of these are exposed over muxrpc (as they're in the manifest) 
and some can only be run locally if you have access to the instance of `app` you 
got returned after initialising it.

### `app.id => String`  (alias `publicKey`)

### `app.getManifest() => Object` (alias: `manifest`)


### `auth: 'async'`
### `address: 'sync'`
### `config => Object'`
### `multiserver.parse: 'sync',`
### `multiserver.address: 'sync'`
### `multiserver.transport: 'sync'`
### `multiserver.transform: 'sync'`


## License

MIT
