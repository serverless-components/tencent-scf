const { Component } = require('@serverless/core')
const DeployFunction = require('./library/deployFunction')
const RemoveFunction = require('./library/removeFunction')
const Provider = require('./library/provider')
const filesize = require('filesize')
const _ = require('lodash')
const utils = require('./library/utils')
const util = require('util')
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
  getAppid(credentials) {
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
      throw e
    }
  }

  async default(inputs = {}) {
    const provider = new Provider(inputs)
    const services = provider.getServiceResource()
    const appId = await this.getAppid(this.context.credentials.tencent)
    this.context.credentials.tencent.AppId = appId.AppId
    const tencent = this.context.credentials.tencent
    const region = provider.region
    const funcObject = _.cloneDeep(services.Resources.default[inputs.name])
    funcObject.FuncName = provider.getFunctionName(inputs.name)

    if (this.state && this.state.deployed && this.state.deployed.Name) {
      if (this.state.deployed.Name != funcObject.FuncName) {
        try {
          const handler = new RemoveFunction(tencent.AppId, tencent.SecretId, tencent.SecretKey, {
            region
          })
          await handler.remove(this.state.deployed.Name)
        } catch (e) {
          this.context.debug('Remove old function failed.')
        }
      }
    }

    const func = new DeployFunction(tencent.AppId, tencent.SecretId, tencent.SecretKey, { region })

    const zipOutput = util.format('%s/%s.zip', this.context.instance.stateRoot, inputs.name)

    this.context.debug(`Compressing function ${funcObject.FuncName} file to ${zipOutput}.`)
    // const codeSize = await utils.zipArchive(inputs.codeUri, zipOutput, inputs.ignores)
    await utils.packDir(inputs.codeUri, zipOutput, inputs.include, inputs.exclude)
    this.context.debug(`Compressed function ${funcObject.FuncName} file successful`)

    const cosBucketName = funcObject.Properties.CodeUri.Bucket
    const cosBucketKey = funcObject.Properties.CodeUri.Key
    this.context.debug(`Uploading service package to cos[${cosBucketName}]. ${cosBucketKey}`)
    await func.uploadPackage2Cos(cosBucketName, cosBucketKey, zipOutput)
    this.context.debug(`Uploaded package successful ${zipOutput}`)

    this.context.debug(`Creating function ${funcObject.FuncName}`)
    await func.deploy('default', funcObject)
    this.context.debug(`Created function ${funcObject.FuncName} successful`)

    const output = {
      Name: funcObject.FuncName,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Region: region,
      Role: funcObject.Properties.Role,
      Description: funcObject.Properties.Description,
      UsingCos: true
      // CodeSize: filesize(codeSize)
    }
    this.state.deployed = output
    await this.save()

    // mutil functions deploy, cloud api qps limit
    await utils.sleep(200)
    return output
  }

  async remove(inputs = {}) {
    this.context.status(`Removing`)

    if (_.isEmpty(this.state.deployed)) {
      this.context.debug(`Aborting removal. Function name not found in state.`)
      return
    }

    const tencent = this.context.credentials.tencent
    const funcObject = this.state.deployed
    const region = funcObject.Region

    const handler = new RemoveFunction(tencent.AppId, tencent.SecretId, tencent.SecretKey, {
      region
    })

    await handler.remove(funcObject.Name)
    this.context.debug(`Removed function ${funcObject.Name} successful`)

    this.state = {}
    await this.save()
    return funcObject
  }
}

module.exports = TencentCloudFunction
