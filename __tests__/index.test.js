const path = require('path')
const { generateId, getServerlessSdk, sleep } = require('./lib/utils')

const appId = process.env.TENCENT_APP_ID
const credentials = {
  tencent: {
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY
  }
}

describe('Scf', () => {
  const events = [
    {
      apigw: {
        parameters: {
          protocols: ['http', 'https'],
          description: 'The service of Serverless Framework',
          environment: 'test',
          endpoints: [
            {
              path: '/',
              method: 'GET'
            }
          ]
        }
      }
    },
    {
      timer: {
        parameters: {
          name: 'timer1',
          cronExpression: '*/5 * * * * * *',
          enable: true,
          argument: 'argument'
        }
      }
    }
  ]

  const codeSrc = path.join(__dirname, '../example/event-src')
  const inputs = {
    name: `scf-integration-tests-${generateId()}`,
    src: {
      src: codeSrc,
      exclude: ['.env']
    },
    region: 'ap-guangzhou',
    runtime: 'Nodejs10.15',
    handler: 'index.main_handler',
    events
  }
  const instanceYaml = {
    org: appId,
    app: 'appDemo',
    component: 'scf@dev',
    name: `scf-integration-tests-${generateId()}`,
    stage: 'dev',
    inputs
  }

  const sdk = getServerlessSdk(instanceYaml.org, appId)

  let lastVersion = '$LATEST'
  const aliasName = 'routing-alias'
  let wt = 0.2
  let weights = {}

  it('deploy', async () => {
    const instance = await sdk.deploy(instanceYaml, credentials)

    expect(instance).toBeDefined()
    expect(instance.instanceName).toEqual(instanceYaml.name)

    const { outputs } = instance
    // get src from template by default
    expect(outputs.functionName).toEqual(inputs.name)
    expect(outputs.runtime).toEqual(inputs.runtime)
    expect(outputs.handler).toEqual(inputs.handler)
    expect(outputs.triggers).toBeDefined()
    expect(outputs.triggers.length).toBe(2)

    const { triggers } = outputs
    const apiTrigger = triggers[0]
    const timerTrigger = triggers[1]

    expect(apiTrigger).toEqual({
      NeedCreate: expect.any(Boolean),
      created: expect.any(Boolean),
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless',
      subDomain: expect.stringContaining('.gz.apigw.tencentcs.com'),
      protocols: 'http&https',
      environment: 'test',
      apiList: [
        {
          created: expect.any(Boolean),
          path: '/',
          method: 'GET',
          apiId: expect.stringContaining('api-'),
          apiName: 'index',
          authType: 'NONE',
          businessType: 'NORMAL',
          internalDomain: expect.any(String),
          isBase64Encoded: false
        }
      ],
      urls: expect.any(Array)
    })

    expect(timerTrigger).toEqual({
      NeedCreate: expect.any(Boolean),
      AddTime: expect.any(String),
      AvailableStatus: 'Available',
      BindStatus: expect.any(String),
      CustomArgument: 'argument',
      Enable: 1,
      ModTime: expect.any(String),
      ResourceId: expect.any(String),
      TriggerAttribute: expect.any(String),
      TriggerDesc: '{"cron":"*/5 * * * * * *"}',
      TriggerName: 'timer1',
      Type: 'timer',
      Qualifier: '$DEFAULT'
    })
  })

  it('update', async () => {
    const instance = await sdk.deploy(instanceYaml, credentials)

    expect(instance).toBeDefined()
    expect(instance.instanceName).toEqual(instanceYaml.name)

    const { outputs } = instance
    // get src from template by default
    expect(outputs.runtime).toEqual(inputs.runtime)
    expect(outputs.handler).toEqual(inputs.handler)
    expect(outputs.triggers).toBeDefined()
    expect(outputs.triggers.length).toBe(2)

    const { triggers } = outputs
    const apiTrigger = triggers[0]
    const timerTrigger = triggers[1]
    expect(apiTrigger).toEqual({
      NeedCreate: expect.any(Boolean),
      created: expect.any(Boolean),
      serviceId: expect.stringContaining('service-'),
      serviceName: 'serverless',
      subDomain: expect.stringContaining('.gz.apigw.tencentcs.com'),
      protocols: 'http&https',
      environment: 'release',
      environment: 'test',
      apiList: [
        {
          created: expect.any(Boolean),
          path: '/',
          method: 'GET',
          apiId: expect.stringContaining('api-'),
          apiName: 'index',
          authType: 'NONE',
          businessType: 'NORMAL',
          internalDomain: expect.any(String),
          isBase64Encoded: false
        }
      ],
      urls: expect.any(Array)
    })

    expect(timerTrigger).toEqual({
      NeedCreate: expect.any(Boolean),
      AddTime: expect.any(String),
      AvailableStatus: 'Available',
      BindStatus: expect.any(String),
      CustomArgument: 'argument',
      Enable: 1,
      ModTime: expect.any(String),
      ResourceId: expect.any(String),
      TriggerAttribute: expect.any(String),
      TriggerDesc: '{"cron":"*/5 * * * * * *"}',
      TriggerName: 'timer1',
      Type: 'timer',
      Qualifier: '$DEFAULT'
    })
  })

  it('publish version', async () => {
    const instance = await sdk.run(
      'publish_ver',
      {
        ...instanceYaml,
        ...{
          inputs: {
            function: inputs.name
          }
        }
      },
      credentials,
      { sync: true }
    )

    expect(instance).toBeDefined()

    const { outputs } = instance

    expect(outputs).toEqual({
      CodeSize: expect.any(Number),
      MemorySize: expect.any(Number),
      Description: expect.any(String),
      Handler: inputs.handler,
      Timeout: 3,
      Runtime: inputs.runtime,
      Namespace: 'default',
      RequestId: expect.any(String),
      lastVersion: expect.any(String)
    })
  })

  it('create alias', async () => {
    const createAliasRes = await sdk.run(
      'publish_ver',
      {
        ...instanceYaml,
        ...{
          inputs: {
            function: inputs.name
          }
        }
      },
      credentials,
      { sync: true }
    )

    ;({ lastVersion } = createAliasRes.outputs)

    weights[lastVersion] = wt

    const createAliasInputs = {
      function: inputs.name,
      name: aliasName,
      version: '1',
      config: { weights }
    }
    const instance = await sdk.run(
      'create_alias',
      {
        ...instanceYaml,
        ...{
          inputs: createAliasInputs
        }
      },
      credentials,
      { sync: true }
    )

    expect(instance).toBeDefined()

    const { outputs } = instance

    expect(outputs.Name).toBe(createAliasInputs.name)
    expect(outputs.FunctionVersion).toBe(createAliasInputs.version)
    expect(outputs.RoutingConfig.AdditionalVersionWeights).toEqual([
      { Version: lastVersion, Weight: wt }
    ])
  })

  it('update alias', async () => {
    wt = 0.3
    weights = {}
    weights[lastVersion] = wt

    const updateAliasInputs = {
      function: inputs.name,
      name: aliasName,
      version: '1',
      config: { weights }
    }
    const instance = await sdk.run(
      'update_alias',
      {
        ...instanceYaml,
        ...{
          inputs: updateAliasInputs
        }
      },
      credentials,
      { sync: true }
    )

    expect(instance).toBeDefined()
    const { outputs } = instance

    expect(outputs.Name).toBe(updateAliasInputs.name)
    expect(outputs.FunctionVersion).toBe(updateAliasInputs.version)
    expect(outputs.RoutingConfig.AdditionalVersionWeights).toEqual([
      { Version: lastVersion, Weight: wt }
    ])
  })

  it('list alias', async () => {
    const listAliasInputs = {
      function: inputs.name,
      name: aliasName
    }
    const instance = await sdk.run(
      'list_alias',
      {
        ...instanceYaml,
        ...{
          inputs: listAliasInputs
        }
      },
      credentials,
      { sync: true }
    )

    expect(instance).toBeDefined()
    const { outputs } = instance

    weights['1'] = 1 - wt
    const weight = {}
    Object.entries(weights).forEach(([key, val]) => {
      weight[key] = `${val}`
    })
    expect(outputs).toEqual({
      alias: [
        { 'routing-alias': { weight: JSON.stringify(weight) } },
        { $DEFAULT: { weight: '{"$LATEST":"1.0"}' } }
      ]
    })
  })

  it('delete alias', async () => {
    const deleteAliasInputs = {
      function: inputs.name,
      name: aliasName
    }
    const instance = await sdk.run(
      'delete_alias',
      {
        ...instanceYaml,
        ...{
          inputs: deleteAliasInputs
        }
      },
      credentials,
      { sync: true }
    )

    expect(instance).toBeDefined()

    const { outputs } = instance
    expect(outputs).toEqual({
      RequestId: expect.any(String)
    })
  })

  it('remove', async () => {
    await sleep(5000)
    await sdk.remove(instanceYaml, credentials)
    const result = await sdk.getInstance(
      instanceYaml.org,
      instanceYaml.stage,
      instanceYaml.app,
      instanceYaml.name
    )

    expect(result.instance.instanceStatus).toEqual('inactive')
  })
})
