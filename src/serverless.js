const { Component } = require('@serverless/core')
const { Scf } = require('tencent-component-toolkit')
const { ApiTypeError } = require('tencent-component-toolkit/lib/utils/error')
const { prepareInputs, prepareAliasInputs, getType, getDefaultProtocol } = require('./utils')
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

  async deploy(inputs) {
    console.log(`Deploying ${CONFIGS.compFullname}`)

    const credentials = this.getCredentials()
    const appId = this.getAppId()

    // 默认值
    const region = inputs.region || CONFIGS.region

    // prepare scf inputs parameters
    const { scfInputs, useDefault } = await prepareInputs(this, credentials, appId, inputs)

    const scf = new Scf(credentials, region)
    const scfOutput = await scf.deploy(scfInputs)

    const outputs = {
      functionName: scfOutput.FunctionName,
      description: scfOutput.Description,
      region: scfOutput.Region,
      namespace: scfOutput.Namespace,
      runtime: scfOutput.Runtime,
      handler: scfOutput.Handler,
      memorySize: scfOutput.MemorySize
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

    const stateApigw = {}
    outputs.triggers = scfOutput.Triggers.map((item) => {
      if (item.serviceId) {
        stateApigw[item.serviceName] = item
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

    console.log(`Removing ${CONFIGS.compFullname}`)
    const scf = new Scf(credentials, region)
    if (functionInfo && functionInfo.FunctionName) {
      await scf.remove(functionInfo)
    }
    this.state = {}
    console.log(`Remove ${CONFIGS.compFullname} success`)
  }

  async list_alias(inputs) {
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const alias_params = {}
      alias_params.functionName = inputs.function
      alias_params.functionVersion = inputs.version
      alias_params.namesapce = inputs.namespace

      console.log(`list alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)

      const scfOutput = await scf.listAlias(alias_params)
      console.log(`list alias for function ${inputs.function}...`)

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

      const alias_params = prepareAliasInputs(inputs)

      if (alias_params.isPramasError) {
        return {
          message: alias_params.message
        }
      }

      console.log(`Creating alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)
      await scf.createAlias(alias_params)
      console.log(`Creating alias for function ${inputs.function}...`)

      const aliasOutput = await scf.getAlias(alias_params)

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

      const alias_params = prepareAliasInputs(inputs)

      if (alias_params.isPramasError) {
        return {
          ErrMsg: alias_params.message
        }
      }

      console.log(`Updating alias for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)

      await scf.updateAlias(alias_params)
      console.log(`Updated alias for function ${inputs.function}...`)

      const aliasOutput = await scf.getAlias(alias_params)

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

      const scfOutput = await scf.deleteAlias(alias_params)
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

      const scfOutput = await scf.publishVersion(publish_params)
      console.log(`published version for function ${inputs.function}...`)

      await scf.isOperationalStatus(scfOutput.Namespace, inputs.function, scfOutput.FunctionVersion)

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
    try {
      const credentials = this.getCredentials()
      const region = inputs.region || CONFIGS.region

      const invoke_params = {}
      invoke_params.functionName = inputs.function
      invoke_params.namespace = inputs.namespace
      invoke_params.invocationType = 'RequestResponse'
      invoke_params.clientContext = inputs.clientContext || {}

      console.log(`invoke for function ${inputs.function}...`)
      const scf = new Scf(credentials, region)

      const scfOutput = await scf.invoke(invoke_params)
      console.log(`invoke for function ${inputs.function}...`)
      return scfOutput
    } catch (e) {
      return {
        requestId: e.reqId,
        message: e.message
      }
    }
  }
}

module.exports = ServerlessComponent
