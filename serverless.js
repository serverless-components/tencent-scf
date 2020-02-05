const { Component } = require('@serverless/core')
const DeployFunction = require('./library/deployFunction')
const DeployTrigger = require('./library/deployTrigger')
const RemoveFunction = require('./library/removeFunction')
const tencentAuth = require('serverless-tencent-auth-tool')
const Provider = require('./library/provider')
const _ = require('lodash')
const util = require('util')
const utils = require('./library/utils')

class TencentCloudFunction extends Component {
  getDefaultProtocol(protocols) {
    if (protocols.map((i) => i.toLowerCase()).includes('https')) {
      return 'https'
    }
    return 'http'
  }

  async default(inputs = {}) {
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-scf',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'default'
    })
    const { tencent } = this.context.credentials

    const provider = new Provider(inputs)
    const services = provider.getServiceResource()

    const option = {
      region: provider.region,
      timestamp: this.context.credentials.tencent.timestamp || null,
      token: this.context.credentials.tencent.token || null
    }
    const attr = {
      appid: tencent.AppId,
      secret_id: tencent.SecretId,
      secret_key: tencent.SecretKey,
      options: option,
      context: this.context
    }
    const func = new DeployFunction(attr)
    const trigger = new DeployTrigger(attr)

    // add role
    inputs.enableRoleAuth = inputs.enableRoleAuth
      ? true
      : inputs.enableRoleAuth == false
      ? false
      : true
    if (inputs.enableRoleAuth) {
      await func.addRole()
    }

    // clean old function
    const funcObject = _.cloneDeep(services.Resources.default[inputs.name])
    funcObject.FuncName = inputs.name
    if (this.state && this.state.deployed && this.state.deployed.Name) {
      if (this.state.deployed.Name != funcObject.FuncName) {
        try {
          const handler = new RemoveFunction(attr)
          await handler.remove(this.state.deployed.Name)
        } catch (e) {
          this.context.debug('Remove old function failed.')
        }
      }
    }

    // packDir
    const zipOutput = util.format('%s/%s.zip', this.context.instance.stateRoot, inputs.name)
    this.context.debug(`Compressing function ${funcObject.FuncName} file to ${zipOutput}.`)
    await utils.packDir(inputs.codeUri, zipOutput, inputs.include, inputs.exclude)
    this.context.debug(`Compressed function ${funcObject.FuncName} file successful`)

    // upload to cos
    const cosBucketName = funcObject.Properties.CodeUri.Bucket
    const cosBucketKey = funcObject.Properties.CodeUri.Key
    this.context.debug(`Uploading service package to cos[${cosBucketName}]. ${cosBucketKey}`)
    await func.uploadPackage2Cos(cosBucketName, cosBucketKey, zipOutput)
    this.context.debug(`Uploaded package successful ${zipOutput}`)

    // create function
    this.context.debug(`Creating function ${funcObject.FuncName}`)
    const oldFunc = await func.deploy('default', funcObject)
    this.context.debug(`Created function ${funcObject.FuncName} successful`)

    // set tags
    this.context.debug(`Setting tags for function ${funcObject.FuncName}`)
    await func.createTags('default', funcObject.FuncName, funcObject.Properties.Tags)

    // deploy trigger
    // apigw: apigw component
    // cos/ckkafka/cmq/timer: cloud api/sdk
    this.context.debug(`Creating trigger for function ${funcObject.FuncName}`)
    const apiTriggerList = new Array()
    const events = new Array()
    if (funcObject.Properties && funcObject.Properties.Events) {
      for (let i = 0; i < funcObject.Properties.Events.length; i++) {
        let status = 'Updating'
        let times = 90
        while (status == 'Updating' || status == 'Creating') {
          const tempFunc = await func.getFunction('default', funcObject.FuncName)
          status = tempFunc.Status
          await utils.sleep(1000)
          times = times - 1
          if (times <= 0) {
            throw `Function ${funcObject.FuncName} update failed`
          }
        }
        if (status != 'Active') {
          throw `Function ${funcObject.FuncName} update failed`
        }

        const keys = Object.keys(funcObject.Properties.Events[i])
        const thisTrigger = funcObject.Properties.Events[i][keys[0]]
        let tencentApiGateway
        if (thisTrigger.Type == 'APIGW') {
          tencentApiGateway = await this.load(
            '@serverless/tencent-apigateway',
            thisTrigger.Properties.serviceName
          )
          thisTrigger.Properties.fromClientRemark = inputs.fromClientRemark || 'tencent-scf'
          const apigwOutput = await tencentApiGateway(thisTrigger.Properties)
          apiTriggerList.push(
            thisTrigger.Properties.serviceName +
              ' - ' +
              this.getDefaultProtocol(apigwOutput['protocols']) +
              '://' +
              apigwOutput['subDomain'] +
              '/' +
              apigwOutput['environment']
          )
        } else {
          events.push(funcObject.Properties.Events[i])
        }
      }
      funcObject.Properties.Events = events
      await trigger.create(
        'default',
        oldFunc ? oldFunc.Triggers : null,
        funcObject,
        (response, thisTrigger) => {
          this.context.debug(
            `Created ${thisTrigger.Type} trigger ${response.TriggerName} for function ${funcObject.FuncName} success.`
          )
        },
        (error) => {
          throw error
        }
      )
    }

    this.context.debug(`Deployed function ${funcObject.FuncName} successful`)

    const output = {
      Name: funcObject.FuncName,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Region: provider.region,
      Description: funcObject.Properties.Description
    }
    if (funcObject.Properties.Role) {
      output.Role = funcObject.Properties.Role
    }
    if (apiTriggerList.length > 0) {
      output.APIGateway = apiTriggerList
    }
    this.state.deployed = output
    await this.save()

    return output
  }

  async remove(inputs = {}) {
    // login
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-scf',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'remove'
    })
    const { tencent } = this.context.credentials

    this.context.status(`Removing`)

    if (_.isEmpty(this.state.deployed)) {
      this.context.debug(`Aborting removal. Function name not found in state.`)
      return
    }

    const funcObject = this.state.deployed

    const option = {
      region: funcObject.Region,
      token: this.context.credentials.tencent.token || null
    }

    const attr = {
      appid: tencent.AppId,
      secret_id: tencent.SecretId,
      secret_key: tencent.SecretKey,
      options: option,
      context: this.context
    }
    const handler = new RemoveFunction(attr)

    let tencentApiGateway
    if (funcObject.APIGateway && funcObject.APIGateway.length > 0) {
      for (let i = 0; i < funcObject.APIGateway.length; i++) {
        try {
          const arr = funcObject.APIGateway[i].toString().split(' - ')
          tencentApiGateway = await this.load('@serverless/tencent-apigateway', arr[0])
          await tencentApiGateway.remove({
            fromClientRemark: inputs.fromClientRemark || 'tencent-scf'
          })
        } catch (e) {}
      }
    }

    await handler.remove(funcObject.Name)
    this.context.debug(`Removed function ${funcObject.Name} successful`)

    this.state = {}
    await this.save()
    return funcObject
  }

  async updateBaseConf(inputs = {}) {
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-scf',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'updateBaseConf'
    })
    const { tencent } = this.context.credentials

    const provider = new Provider(inputs)
    const services = provider.getServiceResource()

    const option = {
      region: provider.region,
      timestamp: this.context.credentials.tencent.timestamp || null,
      token: this.context.credentials.tencent.token || null
    }
    const attr = {
      appid: tencent.AppId,
      secret_id: tencent.SecretId,
      secret_key: tencent.SecretKey,
      options: option,
      context: this.context
    }
    const func = new DeployFunction(attr)

    // add role
    inputs.enableRoleAuth = inputs.enableRoleAuth
      ? true
      : inputs.enableRoleAuth == false
      ? false
      : true
    if (inputs.enableRoleAuth) {
      await func.addRole()
    }

    const funcObject = _.cloneDeep(services.Resources.default[inputs.name])
    funcObject.FuncName = inputs.name
    
    try {
      const oldFunc = await func.getFunction('default', inputs.name, false)
      if (!oldFunc) {
        throw new Error(`Function ${inputs.name} not exist.`)
      }
    } catch (e) {
      throw e
    }

    // create function
    this.context.debug(`Updating function base configuration ${funcObject.FuncName}`)
    await func.updateConfiguration('default', null, funcObject)
    this.context.debug(`Updated function base configuration ${funcObject.FuncName} successful`)

    const output = {
      Name: funcObject.FuncName,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Region: provider.region,
      Description: funcObject.Properties.Description,
      Environment: funcObject.Properties.Environment
    }
    if (funcObject.Properties.Role) {
      output.Role = funcObject.Properties.Role
    }

    this.state.deployed = output
    await this.save()

    return output
  }
}

module.exports = TencentCloudFunction
