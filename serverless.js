const { Component } = require('@serverless/core')
const DeployFunction = require('./library/deployFunction')
const DeployTrigger = require('./library/deployTrigger')
const RemoveFunction = require('./library/removeFunction')
const tencentAuth = require('serverless-tencent-auth-tool')
const Provider = require('./library/provider')
const _ = require('lodash')
const util = require('util')
const cliProgress = require('cli-progress')
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

    const output = {
      Name: funcObject.FuncName,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Region: provider.region,
      Description: funcObject.Properties.Description
    }

    // check code hash, if not change, just updata function configure
    const codeHash = utils.getFileHash(zipOutput)
    const oldHash = this.state.codeHash
    const needUpdateCode = oldHash !== codeHash
    let oldFunc
    if (needUpdateCode) {
      this.state.codeHash = codeHash

      // upload to cos
      const cosBucketName = funcObject.Properties.CodeUri.Bucket
      const cosBucketKey = funcObject.Properties.CodeUri.Key
      this.context.debug(`Uploading service package to cos[${cosBucketName}]. ${cosBucketKey}`)

      // display upload bar
      const { context } = this
      if (!context.instance.multiBar) {
        context.instance.multiBar = new cliProgress.MultiBar({
          forceRedraw: true,
          hideCursor: true,
          linewrap: false,
          clearOnComplete: false,
          format: `  {filename} [{bar}] {percentage}% | ETA: {eta}s | Speed: {speed}k/s`,
          speed: 'N/A'
        })
        context.instance.multiBar.count = 0
      }
      const uploadBar = context.instance.multiBar.create(100, 0, {
        filename: funcObject.FuncName
      })
      context.instance.multiBar.count += 1
      const onProgress = ({ percent, speed }) => {
        const percentage = Math.round(percent * 100)

        if (percent === 1) {
          uploadBar.update(100, {
            speed: (speed / 1024).toFixed(2)
          })
          setTimeout(() => {
            context.instance.multiBar.remove(uploadBar)
          }, 300)
          context.instance.multiBar.count -= 1
          if (context.instance.multiBar.count === 0) {
            setTimeout(() => {
              context.instance.multiBar.stop()
              // eslint-disable-next-line
            }, 300)
          }
        } else {
          uploadBar.update(percentage, {
            speed: (speed / 1024).toFixed(2)
          })
        }
      }
      await func.uploadPackage2Cos(cosBucketName, cosBucketKey, zipOutput, onProgress)

      this.context.debug(`Uploaded package successful ${zipOutput}`)

      // create function
      this.context.debug(`Creating function ${funcObject.FuncName}`)
      oldFunc = await func.deploy(provider.namespace, funcObject, needUpdateCode)
      this.context.debug(`Created function ${funcObject.FuncName} successful`)
    } else {
      this.context.debug(`Function ${funcObject.FuncName} code no change.`)
      // create function
      this.context.debug(`Updating function ${funcObject.FuncName}`)
      oldFunc = await func.deploy(provider.namespace, funcObject, needUpdateCode)
      this.context.debug(`Update function ${funcObject.FuncName} successful`)
    }

    // set tags
    this.context.debug(`Setting tags for function ${funcObject.FuncName}`)
    await func.createTags(provider.namespace, funcObject.FuncName, funcObject.Properties.Tags)

    // deploy trigger
    // apigw: apigw component
    // cos/ckkafka/cmq/timer: cloud api/sdk
    if ((await func.checkStatus(provider.namespace, funcObject)) == false) {
      throw `Function ${funcObject.FuncName} update failed`
    }
    this.context.debug(`Creating trigger for function ${funcObject.FuncName}`)
    const apiTriggerList = new Array()
    const events = new Array()
    if (funcObject.Properties && funcObject.Properties.Events) {
      for (let i = 0; i < funcObject.Properties.Events.length; i++) {
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
        provider.namespace,
        oldFunc ? oldFunc.Triggers : null,
        funcObject,
        (response, thisTrigger) => {
          this.context.debug(
            `Created ${thisTrigger.Type} trigger ${response.TriggerName} for function ${funcObject.FuncName} success.`
          )
        },
        (error) => {
          throw error
        },
        func
      )
    }

    if (apiTriggerList.length > 0) {
      output.APIGateway = apiTriggerList
    }
    this.context.debug(`Deployed function ${funcObject.FuncName} successful`)

    if (funcObject.Properties.Role) {
      output.Role = funcObject.Properties.Role
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
      const oldFunc = await func.getFunction(provider.namespace, inputs.name, false)
      if (!oldFunc) {
        throw new Error(`Function ${inputs.name} not exist.`)
      }
    } catch (e) {
      throw e
    }

    // create function
    this.context.debug(`Updating function base configuration ${funcObject.FuncName}`)
    await func.updateConfiguration(provider.namespace, null, funcObject)
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
