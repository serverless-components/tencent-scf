const { Component } = require('@serverless/core')
const DeployFunction = require('./library/deployFunction')
const RemoveFunction = require('./library/removeFunction')
const Provider = require('./library/provider')
const _ = require('lodash')
const utils = require('./library/utils')
const util = require('util')
const tencentcloud = require('tencentcloud-sdk-nodejs')
const ClientProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/client_profile.js')
const HttpProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/http_profile.js')
const AbstractModel = require('tencentcloud-sdk-nodejs/tencentcloud/common/abstract_model')
const AbstractClient = require('tencentcloud-sdk-nodejs/tencentcloud/common/abstract_client')
const camModels = tencentcloud.cam.v20190116.Models
const CamClient = tencentcloud.cam.v20190116.Client

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
      throw 'Get Appid failed! '
    }
  }
  getCamClient(credentials, region) {
    // create cam client

    const secret_id = credentials.SecretId
    const secret_key = credentials.SecretKey
    const cred = new tencentcloud.common.Credential(secret_id, secret_key)
    const httpProfile = new HttpProfile()
    httpProfile.reqTimeout = 30
    const clientProfile = new ClientProfile('HmacSHA256', httpProfile)
    return new CamClient(cred, region, clientProfile)
  }
  async addRole(credentials) {
    const cam = this.getCamClient(credentials, 'ap-guangzhou')
    cam.sdkVersion = 'ServerlessComponent'
    try {
      const roleName = 'SCF_QcsRole'
      const policyNameList = [
        'QcloudCOSFullAccess',
        'QcloudCOSBucketConfigWrite',
        'QcloudCOSBucketConfigRead',
        'QcloudCOSDataReadOnly',
        'QcloudAPIGWFullAccess'
      ]
      const listPoliciesModels = new camModels.ListPoliciesRequest()
      const listPoliciesHandler = util.promisify(cam.ListPolicies.bind(cam))
      const policyIdList = new Array()
      let pagePolicyCount = 200
      let body = { Rp: 200, Page: 0 }
      while (policyIdList.length < 5 || pagePolicyCount == 200) {
        body.Page = body.Page + 1
        listPoliciesModels.from_json_string(JSON.stringify(body))
        try {
          const pagePolicList = await listPoliciesHandler(listPoliciesModels)
          for (let i = 0; i < pagePolicList.List.length; i++) {
            if (policyNameList.indexOf(pagePolicList.List[i].PolicyName) > -1) {
              policyIdList.push(pagePolicList.List[i].PolicyId)
            }
          }
          pagePolicyCount = pagePolicList.List.length
        } catch (e) {}
        await utils.sleep(400)
      }

      // roleState
      //   1:Created
      //   -1:Not Created
      //   0:Unknown
      let roleState = 1

      // Get role
      try {
        const getRoleModels = new camModels.GetRoleRequest()
        getRoleModels.from_json_string(JSON.stringify({ RoleName: roleName }))
        const getRoleHandler = util.promisify(cam.GetRole.bind(cam))
        await getRoleHandler(getRoleModels)
      } catch (e) {
        if (e.message.includes('role not exist')) {
          roleState = -1
        } else {
          roleState = 0
        }
      }

      const haveIdList = new Array()
      const addIdList = new Array()

      // Get role policy list
      try {
        pagePolicyCount = 200
        body = { Rp: 200, Page: 0, RoleName: roleName }
        const listRolePoliciesModels = new camModels.ListAttachedRolePoliciesRequest()
        const listRolePoliciesHandler = util.promisify(cam.ListAttachedRolePolicies.bind(cam))
        while (pagePolicyCount == 200) {
          body.Page = body.Page + 1
          listRolePoliciesModels.from_json_string(JSON.stringify(body))
          try {
            const pagePolicList = await listRolePoliciesHandler(listRolePoliciesModels)
            for (let i = 0; i < pagePolicList.List.length; i++) {
              haveIdList.push(pagePolicList.List[i].PolicyId)
            }
            pagePolicyCount = pagePolicList.List.length
          } catch (e) {
            pagePolicyCount = 0
          }
          await utils.sleep(400)
        }
      } catch (e) {}

      // Get policy id which need to add in SCF_QcsRole
      for (let i = 0; i < policyIdList.length; i++) {
        if (haveIdList.indexOf(policyIdList[i]) <= -1) {
          addIdList.push(policyIdList[i])
        }
      }

      // Create role and attach policy
      if (roleState <= 0) {
        try {
          const createRoleModels = new camModels.CreateRoleRequest()
          createRoleModels.from_json_string(
            JSON.stringify({
              RoleName: roleName,
              PolicyDocument: JSON.stringify({
                version: '2.0',
                statement: [
                  {
                    effect: 'allow',
                    principal: {
                      service: 'scf.qcloud.com'
                    },
                    action: 'sts:AssumeRole'
                  }
                ]
              })
            })
          )
          const createRoleHandler = util.promisify(cam.CreateRole.bind(cam))
          await createRoleHandler(createRoleModels)
        } catch (e) {
          this.context.debug('Create role error: ' + e)
        }
      }
      if (addIdList.length > 0) {
        try {
          const attachRolePolicyModels = new camModels.AttachRolePolicyRequest()
          const attachRolePolicyHandler = util.promisify(cam.AttachRolePolicy.bind(cam))
          const attachRolePolicyBody = {
            AttachRoleName: roleName
          }
          for (let i = 0; i < addIdList.length; i++) {
            try {
              attachRolePolicyBody.PolicyId = addIdList[i]
              attachRolePolicyModels.from_json_string(JSON.stringify(attachRolePolicyBody))
              await attachRolePolicyHandler(attachRolePolicyModels)
            } catch (e) {
              this.context.debug(`Attach policy id '${attachRolePolicyBody.PolicyId}' error: ${e}`)
            }
            await utils.sleep(400)
          }
        } catch (e) {}
      }
    } catch (e) {
      this.context.debug('Check policy list error: ' + e)
    }
  }

  async default(inputs = {}) {
    const provider = new Provider(inputs)
    const services = provider.getServiceResource()
    const { tencent } = this.context.credentials
    const appId = await this.getAppid(tencent)
    this.context.credentials.tencent.AppId = appId.AppId
    inputs.roleAuth = inputs.roleAuth ? true : inputs.roleAuth == false ? false : true
    if (inputs.roleAuth) {
      await this.addRole(tencent)
    }
    const { region } = provider
    const funcObject = _.cloneDeep(services.Resources.default[inputs.name])
    funcObject.FuncName = inputs.name

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
    }
    this.state.deployed = output
    await this.save()

    // mutil functions deploy, cloud api qps limit
    await utils.sleep(200)
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
