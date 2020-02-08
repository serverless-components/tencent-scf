const test = require('tape')

const Provider = require('./provider')

test('namespace', (t) => {
  t.plan(2)
  let provider

  // with inputs
  const inputs = {
    namespace: 'myspace'
  }
  provider = new Provider(inputs)
  t.equal(provider.namespace, 'myspace')

  // without inputs
  provider = new Provider()
  t.equal(provider.namespace, 'default')
})
