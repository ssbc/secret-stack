
//it became easier to debug by making the keys deterministic
//and it becomes easier still if the pubkeys are recognisable.
//so i mined for keys that started with the names I wanted.
//using vanity-ed25519 module.

function S (base64) {
  return new Buffer(base64, 'base64')
}

exports.alice = S('8C37zWNNunT5q2K8hS9WX6FitXQ9kfU6uZLJV+Swc/s=')
exports.bob   = S('mRw/ScuApTnmNNfRXf85YCSA1bHTsdyM0uJcI/3OoNk=')
exports.carol = S('EwS1uQPplLvG006DMhMoTSdpitB5adyWP2kt/H7/su0=')
