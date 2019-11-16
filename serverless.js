const { Component } = require('@serverless/core')
const DeployFunction = require('./library/deployFunction')
const DeployTrigger = require('./library/deployTrigger')
const RemoveFunction = require('./library/removeFunction')
const Provider = require('./library/provider')
const _ = require('lodash')
const util = require('util')
const utils = require('./library/utils')
const tencentcloud = require('tencentcloud-sdk-nodejs')
const ClientProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/client_profile.js')
const HttpProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/http_profile.js')
const AbstractModel = require('tencentcloud-sdk-nodejs/tencentcloud/common/abstract_model')
const AbstractClient = require('tencentcloud-sdk-nodejs/tencentcloud/common/abstract_client')

class GetUserAppIdResponse extends AbstractModel {
  constructor() {
    super()
    this.RequestId = null
  }

  deserialize(params) {
    if (!params) {
      return
    }
    this.AppId = 'RequestId' in params ? params.AppId : null
    this.RequestId = 'RequestId' in params ? params.RequestId : null
  }
}

class AppidClient extends AbstractClient {
  constructor(credential, region, profile) {
    super('cam.tencentcloudapi.com', '2019-01-16', credential, region, profile)
  }

  GetUserAppId(req, cb) {
    const resp = new GetUserAppIdResponse()
    this.request('GetUserAppId', req, resp, cb)
  }
}

class TencentCloudFunction extends Component {
  async getAppid(credentials) {
    const secret_id = credentials.SecretId
    const secret_key = credentials.SecretKey
    const cred = new tencentcloud.common.Credential(secret_id, secret_key)
    const httpProfile = new HttpProfile()
    httpProfile.reqTimeout = 30
    const clientProfile = new ClientProfile('HmacSHA256', httpProfile)
    const cam = new AppidClient(cred, 'ap-guangzhou', clientProfile)
    const req = new GetUserAppIdResponse()
    const body = {}
    req.from_json_string(JSON.stringify(body))
    const handler = util.promisify(cam.GetUserAppId.bind(cam))
    try {
      return handler(req)
    } catch (e) {
      throw 'Get Appid failed! '
    }
  }

  async default(inputs = {}) {
    const provider = new Provider(inputs)
    const services = provider.getServiceResource()
    const { tencent } = this.context.credentials
    const appId = await this.getAppid(tencent)
    const option = { region: provider.region }
    this.context.credentials.tencent.AppId = appId.AppId
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
    for (let i = 0; i < funcObject.Properties.Events.length; i++) {
      const keys = Object.keys(funcObject.Properties.Events[i])
      const thisTrigger = funcObject.Properties.Events[i][keys[0]]
      let tencentApiGateway
      if (thisTrigger.Type == 'APIGW') {
        tencentApiGateway = await this.load(
          '@serverless/tencent-apigateway',
          thisTrigger.Properties.serviceName
        )
        const apigwOutput = await tencentApiGateway(thisTrigger.Properties)
        apiTriggerList.push(apigwOutput['subDomain'])
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

    this.context.debug(`Deployed function ${funcObject.FuncName} successful`)

    const output = {
      Name: funcObject.FuncName,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Region: provider.region,
      Role: funcObject.Properties.Role,
      Description: funcObject.Properties.Description,
      APIGateway: apiTriggerList
    }
    this.state.deployed = output
    await this.save()

    return output
  }

  async remove() {
    this.context.status(`Removing`)

    if (_.isEmpty(this.state.deployed)) {
      this.context.debug(`Aborting removal. Function name not found in state.`)
      return
    }

    const { tencent } = this.context.credentials
    const funcObject = this.state.deployed
    const option = { region: funcObject.Region }

    const handler = new RemoveFunction(
      tencent.AppId,
      tencent.SecretId,
      tencent.SecretKey,
      option,
      this.context
    )

    await handler.remove(funcObject.Name)
    this.context.debug(`Removed function ${funcObject.Name} successful`)

    this.state = {}
    await this.save()
    return funcObject
  }
}

module.exports = TencentCloudFunction
