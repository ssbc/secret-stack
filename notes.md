the `connect` function -- https://github.com/ssb-js/secret-stack/blob/76d1432ac2db60ac14fa986eed84910dacd45ea6/src/core.ts#L293 -- calls setupRpc with `isClient` set to true.

So whichever muxrpc initiates the connection is the client.

---------------------------------------------------

_unraveling the secret-stack_

The `connect` function calls `setupRPC`, which calls `Muxrpc` with `isClient` set to true. So whichever `secret-stack` calls `connect` on an address is the client, and if we look here — https://github.com/ssb-js/secret-stack/blob/76d1432ac2db60ac14fa986eed84910dacd45ea6/src/core.ts#L233

you can see the permissions uses `anonymous`

```js
const rpc = Muxrpc(
  manifest,
  manf ?? manifest,
  api,
  _id,
  isClient
    ? permissions.anonymous
    : isPermissions(stream.auth)
      ? stream.auth
      : permissions.anonymous,
  false
)
```

and the `permissions` object is passed into the function `init`.


where ssb-conn calls secret-stack's `.connect` :
https://github.com/staltz/ssb-conn-hub/blob/master/src/index.ts#L243

```js
var [err, rpc] = connect

this._rpcs.set(address, rpc);
```
