const test = require('tape')

const Component = require('./serverless')

test('getDefaultProtocol()', (t) => {
  t.plan(5)

  const comp = new Component()
  t.equal(comp.getDefaultProtocol(['http']), 'http')
  t.equal(comp.getDefaultProtocol(['https']), 'https')
  t.equal(comp.getDefaultProtocol(['http', 'https']), 'https')
  t.equal(comp.getDefaultProtocol(['HTTP', 'hTTpS']), 'https')
  t.equal(comp.getDefaultProtocol(['http', 'ftp']), 'http')
})

test('functionStateChange()', (t) => {
  t.plan(5)

  const comp = new Component()
  const newState = {
    codeHash: 'f463db7cd6f3354303e790da50fb2d86',
    deployed: {
      Name: 'myFunction1',
      Runtime: 'Nodejs8.9',
      Handler: 'index.main_handler',
      MemorySize: 128,
      Timeout: 3,
      Region: 'ap-guangzhou',
      Namespace: 'default',
      Description: 'This is a template function'
    }
  }
  const oldState = {
    codeHash: 'f463db7cd6f3354303e790da50fb2d86',
    deployed: {
      Name: 'myFunction1',
      Runtime: 'Nodejs8.9',
      Handler: 'index.main_handler',
      MemorySize: 128,
      Timeout: 3,
      Region: 'ap-guangzhou',
      Namespace: 'default',
      Description: 'This is a template function'
    }
  }

  // no change
  t.equal(comp.functionStateChange({ newState, oldState }), false)

  // code hash change
  oldState.codeHash += 'xxx'
  t.equal(comp.functionStateChange({ newState, oldState }), true)
  oldState.codeHash += newState.codeHash

  // function name change
  oldState.deployed.Name += 'xxx'
  t.equal(comp.functionStateChange({ newState, oldState }), true)
  oldState.deployed.Name += newState.deployed.Name

  // region change
  oldState.deployed.Region = 'ap-chengdu'
  t.equal(comp.functionStateChange({ newState, oldState }), true)
  oldState.deployed.Region = newState.deployed.Region

  // namespace change
  oldState.deployed.Namespace = 'myspace'
  t.equal(comp.functionStateChange({ newState, oldState }), true)
  oldState.deployed.Namespace = newState.deployed.Region
})
