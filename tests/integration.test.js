const { generateId, getServerlessSdk } = require('./utils')

// set enough timeout for deployment to finish
jest.setTimeout(600000)

// the yaml file we're testing against
const instanceYaml = {
  org: 'orgDemo',
  app: 'appDemo',
  component: 'scf@dev',
  name: `scf-integration-tests-${generateId()}`,
  stage: 'dev',
  inputs: {
    region: 'ap-guangzhou',
    runtime: 'Nodejs10.15',
    handler: 'index.main_handler',
    events: [
      {
        apigw: {
          name: 'serverless_api',
          parameters: {
            protocols: ['http', 'https'],
            description: 'The service of Serverless Framework',
            environment: 'test',
            endpoints: [
              {
                path: '/',
                method: 'GET'
              },
              {
                path: '/ws-scf',
                protocol: 'WEBSOCKET',
                method: 'GET',
                apiName: 'WS-SCF-API',
                function: {
                  transportFunctionName: 'myFunction',
                  registerFunctionName: 'myFunction',
                  cleanupFunctionName: 'myFunction'
                }
              }
            ]
          }
        }
      }
    ]
  }
}

// get credentials from process.env but need to init empty credentials object
const credentials = {
  tencent: {}
}

// get serverless construct sdk
const sdk = getServerlessSdk(instanceYaml.org)

it('should successfully deploy scf service', async () => {
  const instance = await sdk.deploy(instanceYaml, { tencent: {} })

  expect(instance).toBeDefined()
  expect(instance.instanceName).toEqual(instanceYaml.name)
  // get src from template by default
  expect(instance.outputs.templateUrl).toBeDefined()
  expect(instance.outputs.runtime).toEqual(instanceYaml.inputs.runtime)
  expect(instance.outputs.handler).toEqual(instanceYaml.inputs.handler)
  expect(instance.outputs.triggers).toBeDefined()
  expect(instance.outputs.triggers.apigw).toBeDefined()

  expect(instance.state).toBeDefined()
  expect(instance.state.region).toEqual(instanceYaml.inputs.region)
  expect(instance.state.function).toBeDefined()
  expect(instance.state.function.Triggers).toBeDefined()
  expect(instance.state.function.Triggers.length).toEqual(1)
  expect(instance.state.function.Triggers[0].environment).toEqual(instanceYaml.inputs.events[0].apigw.parameters.environment)
  expect(instance.state.function.Triggers[0].apiList).toBeDefined()
  expect(instance.state.function.Triggers[0].apiList.length).toEqual(2)
  expect(instance.state.function.Triggers[0].apiList[0].path).toEqual(instanceYaml.inputs.events[0].apigw.parameters.endpoints[0].path)
  expect(instance.state.function.Triggers[0].apiList[0].method).toEqual(instanceYaml.inputs.events[0].apigw.parameters.endpoints[0].method)
  expect(instance.state.function.Triggers[0].apiList[1].path).toEqual(instanceYaml.inputs.events[0].apigw.parameters.endpoints[1].path)
  expect(instance.state.function.Triggers[0].apiList[1].method).toEqual(instanceYaml.inputs.events[0].apigw.parameters.endpoints[1].method)
})

it('should successfully remove scf service', async () => {
  await sdk.remove(instanceYaml, credentials)
  result = await sdk.getInstance(
    instanceYaml.org,
    instanceYaml.stage,
    instanceYaml.app,
    instanceYaml.name
  )

  expect(result.instance.instanceStatus).toEqual('inactive')
})
