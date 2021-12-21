const { Component } = require('@serverless/core')
const { Scf, Monitor } = require('tencent-component-toolkit')
const { ApiTypeError } = require('tencent-component-toolkit/lib/utils/error')
const {
  formatInputs,
  formatAliasInputs,
  getType,
  getDefaultProtocol,
  formatMetricData,
  strip
} = require('./utils')
const CONFIGS = require('./config')

class ServerlessComponent extends Component {
  getCredentials() {
    const { tmpSecrets } = this.credentials.tencent

    if (!tmpSecrets || !tmpSecrets.TmpSecretId) {
      throw new ApiTypeError(
        'CREDENTIAL',
        `Cannot get secretId/Key, your account could be sub-account and does not have the access to use SLS_QcsRole, please make sure the role exists first, then visit https://cloud.tencent.com/document/product/1154/43006, follow the instructions to bind the role to your account.`
      )
    }

    return {
      SecretId: tmpSecrets.TmpSecretId,
      SecretKey: tmpSecrets.TmpSecretKey,
      Token: tmpSecrets.Token
    }
  }

  getAppId() {
    return this.credentials.tencent.tmpSecrets.appId
  }

  async wait(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms))
  }

  async deploy(inputs) {
    const credentials = this.getCredentials()
    const appId = this.getAppId()
    const region = inputs.region || CONFIGS.region
    const faasType = inputs.type || 'event'

    const { scfInputs, useDefault } = await formatInputs(this, credentials, appId, inputs)

    const scf = new Scf(credentials, region)
    const scfOutput = await scf.deploy(scfInputs)

    if (inputs.provisionedNum) {
      let qualifier
      if (!inputs.qualifier) {
        const publishVersionInputs = {
          functionName: scfOutput.FunctionName,
          description: scfOutput.Description || null,
          namesapce: scfOutput.Namesapce || 'default'
        }
        const verionRes = await scf.version.publish(publishVersionInputs)
        /* eslint prefer-destructuring: ["error", {VariableDeclarator: {object: true}}] */
        qualifier = verionRes.FunctionVersion
      } else {
        qualifier = inputs.qualifier
      }

      await this.wait(1500)
      // 预置并发
      const concurrencyRes = await scf.concurrency.setProvisioned({
        functionName: scfOutput.FunctionName,
        namespace: scfOutput.Namespace,
        provisionedNum: inputs.provisionedNum,
        qualifier
      })
      console.log('Preset concurrency succeeded', concurrencyRes)
      // 设置流量控制
      if (inputs.traffic) {
        const flowRes = await scf.alias.update({
          functionName: scfOutput.FunctionName,
          namespace: scfOutput.Namespace,
          region: this.region,
          additionalVersions: [{ weight: strip(1 - inputs.traffic), version: qualifier }],
          aliasName: inputs.aliasName,
          description: inputs.aliasDescription
        })
        console.log('Flow setting successed', flowRes)
      }
    }
    const outputs = {
      type: faasType,
      functionName: scfOutput.FunctionName,
      code: scfInputs.code,
      description: scfOutput.Description,
      region: scfOutput.Region,
      namespace: scfOutput.Namespace,
      runtime: scfOutput.Runtime,
      handler: scfOutput.Handler,
      memorySize: scfOutput.MemorySize,
      entryFile: scfInputs.entryFile
    }

    if (scfOutput.Layers && scfOutput.Layers.length > 0) {
      outputs.layers = scfOutput.Layers.map((item) => ({
        name: item.LayerName,
        version: item.LayerVersion
      }))
    }

    // default version is $LATEST
    outputs.lastVersion = scfOutput.LastVersion
      ? scfOutput.LastVersion
      : this.state.lastVersion || '$LATEST'

    // default traffic is 1.0, it can also be 0, so we should compare to undefined
    outputs.traffic =
      scfOutput.Traffic !== undefined
        ? scfOutput.Traffic
        : this.state.traffic !== undefined
        ? this.state.traffic
        : 1

    if (outputs.traffic !== 1 && scfOutput.ConfigTrafficVersion) {
      outputs.configTrafficVersion = scfOutput.ConfigTrafficVersion
      this.state.configTrafficVersion = scfOutput.ConfigTrafficVersion
    }

    this.state.lastVersion = outputs.lastVersion
    this.state.traffic = outputs.traffic
    this.state.entryFile = outputs.entryFile

    const stateApigw = {}
    outputs.triggers = scfOutput.Triggers.map((item) => {
      if (item.serviceId) {
        stateApigw[item.serviceName] = item
        stateApigw[item.serviceId] = item
        item.urls = []
        item.apiList.forEach((apiItem) => {
          if (getType(item.subDomain) === 'Array') {
            item.subDomain.forEach((domain) => {
              item.urls.push(
                `${getDefaultProtocol(item.protocols)}://${domain}/${item.environment}${
                  apiItem.path
                }`
              )
            })
          } else {
            item.urls.push(
              `${getDefaultProtocol(item.protocols)}://${item.subDomain}/${item.environment}${
                apiItem.path
              }`
            )
          }
        })
      }
      return item
    })
    this.state.apigw = stateApigw

    if (useDefault) {
      outputs.templateUrl = CONFIGS.templateUrl
    }

    this.state.region = region
    this.state.function = scfOutput

    // must add this property for debuging online
    this.state.lambdaArn = scfOutput.FunctionName

    await this.save()

    console.log(`Deploy ${CONFIGS.compFullname} success`)
    return outputs
  }

  // eslint-disable-next-line
  async remove(inputs = {}) {
    const credentials = this.getCredentials()
    const { region } = this.state
    const functionInfo = this.state.function

    const scf = new Scf(credentials, region)
    if (functionInfo && functionInfo.FunctionName) {
      await scf.remove(functionInfo)
    }
    this.state = {}
  }

  async list_alias(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const functionInfo = this.state.function
      const functionName = inputs.function || (functionInfo && functionInfo.FunctionName)

      const alias_params = {}
      alias_params.functionName = functionName
      alias_params.functionVersion = inputs.version
      alias_params.namesapce = inputs.namespace

      console.log(`List alias for function ${functionName}...`)
      const scf = new Scf(credentials, region)

      const scfOutput = await scf.alias.list(alias_params)

      const aliases = scfOutput.Aliases
      const listAlias = {
        alias: []
      }

      for (let i = 0; i < aliases.length; i++) {
        const mainVersion = aliases[i].FunctionVersion
        const addWeights = aliases[i].RoutingConfig.AdditionalVersionWeights[0] || { Weight: 0 }
        const otherVersion = addWeights.Version || null
        const otherWeight = Number(addWeights.Weight).toFixed(1) || 0
        const mainWeight = (1 - otherWeight).toFixed(1)

        const alias_unit = {}
        alias_unit[aliases[i].Name] = {}
        const weight = {}
        weight[mainVersion] = mainWeight
        if (otherVersion) {
          weight[otherVersion] = otherWeight
        }
        alias_unit[aliases[i].Name].weight = JSON.stringify(weight)

        listAlias.alias.push(alias_unit)
      }
      console.log(listAlias)
      return listAlias
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async create_alias(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const functionInfo = this.state.function
      inputs.function = inputs.function || (functionInfo && functionInfo.FunctionName)

      const alias_params = formatAliasInputs(inputs)

      if (alias_params.isPramasError) {
        return {
          message: alias_params.message
        }
      }

      console.log(`Creating alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)
      await scf.alias.create(alias_params)

      const aliasOutput = await scf.alias.get(alias_params)

      return aliasOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async update_alias(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const functionInfo = this.state.function
      inputs.function = inputs.function || (functionInfo && functionInfo.FunctionName)

      const alias_params = formatAliasInputs(inputs)

      if (alias_params.isPramasError) {
        return {
          ErrMsg: alias_params.message
        }
      }

      console.log(`Updating alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)

      await scf.alias.update(alias_params)
      console.log(`Updated alias for function ${inputs.function}...`)

      const aliasOutput = await scf.alias.get(alias_params)

      return aliasOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async delete_alias(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const alias_params = {}
      alias_params.functionName = inputs.function
      alias_params.aliasName = inputs.name
      alias_params.namesapce = inputs.namespace

      console.log(`delete alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)

      const scfOutput = await scf.alias.delete(alias_params)
      console.log(`deleted alias for function ${inputs.function}...`)
      return scfOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async publish_ver(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const publish_params = {}
      publish_params.functionName = inputs.function
      publish_params.namespace = inputs.namespace
      publish_params.description = inputs.description

      const scf = new Scf(credentials, region)

      const scfOutput = await scf.version.publish(publish_params)

      await scf.scf.isOperational({
        namespace: scfOutput.Namespace,
        functionName: inputs.function,
        qualifier: scfOutput.FunctionVersion
      })

      this.state.lastVersion = scfOutput.FunctionVersion
      await this.save()
      scfOutput.lastVersion = scfOutput.FunctionVersion
      delete scfOutput.FunctionVersion

      return scfOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async invoke(inputs) {
    const invokeTypeMap = {
      // 同步
      request: 'RequestResponse',
      // 异步
      event: 'Event'
    }
    const logTypeMap = {
      tail: 'Tail',
      none: 'None'
    }
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region
      const { asyncRun } = inputs
      const invoke_params = {}
      invoke_params.namespace = inputs.namespace || 'default'
      if (asyncRun) {
        invoke_params.invocationType = invokeTypeMap.request
        invoke_params.logType = logTypeMap.tail
      } else {
        invoke_params.invocationType = invokeTypeMap.event
        invoke_params.logType = logTypeMap.none
      }
      invoke_params.clientContext = inputs.event || inputs.clientContext || {}

      const functionInfo = this.state.function
      const functionName = inputs.function || (functionInfo && functionInfo.FunctionName)

      if (!functionName) {
        throw new ApiTypeError(`SCF_method_invoke`, `[SCF] 参数 function 必须`)
      }

      invoke_params.functionName = functionName

      const scf = new Scf(credentials, region)

      console.log(`Invoke for function ${functionName}`)
      const scfOutput = await scf.invoke(invoke_params)
      return scfOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }

  async log(inputs) {
    const credentials = this.getCredentials()
    const region = inputs.region || CONFIGS.region
    const functionInfo = this.state.function
    const functionName = inputs.function || (functionInfo && functionInfo.FunctionName)

    if (!functionName) {
      throw new ApiTypeError(`SCF_method_log`, `[SCF] 参数 function 必须`)
    }

    console.log(`Get logs for function ${functionName}`)
    const scf = new Scf(credentials, region)

    const scfOutput = await scf.logs({
      functionName: functionName,
      namespace: inputs.namespace,
      qualifier: inputs.qualifier,
      reqId: inputs.reqid
    })

    return scfOutput
  }

  async metric(inputs) {
    const credentials = this.getCredentials()
    const region = inputs.region || CONFIGS.region

    const functionInfo = this.state.function
    const functionName = inputs.function || (functionInfo && functionInfo.FunctionName)

    if (!functionName) {
      throw new ApiTypeError(`SCF_method_metric`, `[SCF] 参数 function 必须`)
    }

    if (!inputs.metric) {
      throw new ApiTypeError(`SCF_method_metric`, `[SCF] 参数 metric 必须`)
    }

    console.log(`Get metric ${inputs.metric} for function ${functionName}`)
    const monitor = new Monitor(credentials, region)

    const res = await monitor.get({
      functionName: functionName,
      namespace: inputs.namespace,
      alias: inputs.alias,
      metric: inputs.metric,
      interval: inputs.interval,
      period: inputs.period,
      startTime: inputs.startTime,
      endTime: inputs.endTime
    })

    return formatMetricData(res)
  }
}

module.exports = ServerlessComponent
