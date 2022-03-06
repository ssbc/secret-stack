const SecretStack = require('./lib')
const ssbKeys = require('ssb-keys')
const S = require('pull-stream')
const path = require('path')
var keys = ssbKeys.loadOrCreateSync(path.join(__dirname, 'secret'))

var myPlugin = {
    name: 'myPlugin',
    version: '0.0.0',
    manifest: {
      foo: 'async',
      bar: 'source'
    },

    init: (api, opts) => {
      // .. do things

    //   console.log('api', api)
    //   console.log('opts', opts)
  
      // return things promised by the manifest:
      return {
        foo: function (cb) {  // an async function (takes a callback)
            process.nextTick(() => {
                cb(null, 'foo')
            })
        }, 

        bar: function () {  // a function which returns a pull-stream source 
            return S.values([1,2,3])
        } 
      }
    }
}

var App = SecretStack({
    appKey: '1KHLiKZvAvjbY1ziZEHMXawbCEIM6qwjCDm3VYRan/s=',
    permissions: {}
})
  .use(myPlugin)

var app = App({ keys })
// var app = App({})

console.log('address', app.getAddress())
