const SecretStack = require('./lib')
const ssbKeys = require('ssb-keys')
const S = require('pull-stream')
const path = require('path')
var keys = ssbKeys.loadOrCreateSync(path.join(__dirname, 'secret'))
var keysTwo = ssbKeys.loadOrCreateSync(path.join(__dirname, 'secret-two'))
var Perms = require('muxrpc/permissions')

var App = SecretStack({
    appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=',
    // permissions: {}
})
    .use(createMyPlugin('one'))

var app = App({ keys })

const addr = app.getAddress()
console.log('address', addr)

// app.auth.hook(function (auth, args) {
//     console.log('hook', auth, args)
//     var cb = args.pop()
//     var id = args.shift()
//     auth(id, function (err, perms) {
//         if (err) return cb(err)
//         console.log('hook auth', id, err, perms)
//         cb(null, { allow: ['foo', 'bar'] })
//     })
// })

// ... in a different process ...
var SecondApp = SecretStack({
    appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=',
    // permissions: {}
})
    .use(createMyPlugin('two'))

const secondApp = SecondApp({ keys: keysTwo })

secondApp.connect(addr, (err, rpc) => {
    console.log('*connected*', err)
    console.log('*rpc keys*', Object.keys(rpc.myPlugin))

    rpc.myPlugin.foo((err, res) => {
        console.log('*foo reponse*', err, res)

        app.close(null, (err) => {
            console.log('closed', err)
            secondApp.close(null, err => {
                console.log('closed 2', err)
            })
        })
    })
})


// var perms = Perms({ allow: ['foo', 'bar'] })
// console.log('perms', perms)


function createMyPlugin (str) {
    return {
        name: 'myPlugin',
        version: '0.0.0',
        manifest: {
            foo: 'async',
            bar: 'source'
        },

        // permissions: perms,
        permissions: {
            // anonymous: { allow: ['foo', 'bar'], deny: [] }
        },

        init: (api, opts) => {
            // .. do things

            // return things promised by the manifest:
            return {
                foo: function (cb) {  // an async function (takes a callback)
                    process.nextTick(() => {
                        cb(null, 'foo' + '-' + str)
                    })
                }, 

                // a function which returns a pull-stream source 
                bar: function () {  
                    return S.values([1,2,3])
                } 
            }
        }
    }
}
