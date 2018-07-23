# secret-stack

create secure peer to peer networks using secret-handshakes.

SecretStack is built on [secret-handshake](https://github.com/dominictarr/secret-handshake)
and [muxrpc](https://github.com/ssbc/muxrpc). This provides a framework
to make building secure, decentralized systems easier.
(such as [scuttlebot](https://github.com/ssbc/scuttlebot) which this was refactored out of ;)

## Example

``` js
var SecretStack = require('secret-stack')

var createApp = SecretStack({
  appKey: appKey //32 random bytes
})
.use({
  //plugin
  //name of the plugin, this is where it will be "mounted"
  name: 'foo',
  //muxrpc manifest
  manifest: {
     bar: 'async'
  },
  //permissions will be merged into the main permissions,
  //prefixed with the plugin name.
  //so theirfore this becomes 'foo.bar'.
  permissions: {
    anonymous: [
      'bar'
    ]
  },
  init: function (api, opts) {
    //set up and return some methods...
    return {
      bar: function (arg, cb) {
        //do something async
        cb(null, result)
      }
    }
  }
})
```

## create = SecretStack(opts)

initialize a new app factory.
opts must have a property `appKey` which should
be a high entropy (i.e. random) 32 byte value.
It is fixed for your app. Actors who do not know this value
will not be able to connect to instances of your app.

### create.use(plugin)

set up the factory by adding plugins. see the example above.

### plugin.init (api, opts)

each plugin init function is called in the order they where
added and it may return an object which is combined into the api.
if `plugin.name` is a string, then it's added as `api[plugin.name]=plugin.init(api, opts)`
else, it's merged with the api object.

Note, each method on the api gets wrapped with [hoox](https://github.com/dominictarr/hoox)
so that plugins may intercept that function.
So far, the ways i have used this is to manage permissions,
for example, to extend the auth method (see below) or to filter
the output of a stream.

### connect = create.createClient(opts)

sometimes you need to create a connection using a different key pair,
and/or to connect without providing access for the remote to your local api.
`opts` must have a sodium ed25519 key pair, or a `seed` (32 byte random)
value, from which a private key will be generated.

`connect` then takes the same arguments as `node.connect`

### node = create (opts)

create an actual instance! opts must have a `keys` property
which is a sodium ed25519 key pair.

### node.getAddress()

get a string representing the address of this node.
it will be `ip:port:<base64:pubkey>`.

### node.connect(address, cb)

create a rpc connection to another instance.
Address should be the form returned by `getAddress`

### node.auth(publicKey, cb)

Query what permissions a given public key is assigned.
it's not intended for this to be exposed over the network,
but rather to extend this method to create plugable permissions systems.

``` js
node.auth.hook(function (auth, args) {
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

## License

MIT
