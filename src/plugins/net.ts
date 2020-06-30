const Net = require('multiserver/plugins/net')
const debug = require('debug')('secret-stack net plugin')

export = {
  name: 'multiserver-net',
  version: '1.0.0',
  manifest: {},
  init (ssk: any) {
    ssk.multiserver.transport({
      name: 'net',
      create: (opts: any) => {
        debug(
          'creating transport host=%s port=%d scope=%s',
          opts.host,
          opts.port,
          opts.scope
        )
        // let multiserver figure out the defaults
        return Net(opts)
      }
    })
  }
};
