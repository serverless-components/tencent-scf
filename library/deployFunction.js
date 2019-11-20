const tencentcloud = require('tencentcloud-sdk-nodejs')
const Abstract = require('./abstract')
const utils = require('./utils')
const fs = require('fs')
const _ = require('lodash')
const util = require('util')
const models = tencentcloud.scf.v20180416.Models
const camModels = tencentcloud.cam.v20190116.Models

class DeployFunction extends Abstract {
  async deploy(ns, funcObject) {
    const func = await this.getFunction(ns, funcObject.FuncName)
    if (!func) {
      await this.createFunction(ns, funcObject)
    } else {
      if (func.Runtime != funcObject.Properties.Runtime) {
        throw `Runtime error: Release runtime(${func.Runtime}) and local runtime(${funcObject.Properties.Runtime}) are inconsistent`
      }
      this.context.debug('Updating code... ')
      await this.updateFunctionCode(ns, funcObject)
      // when update code Status is Active, continue
      let status = 'updating'
      while (status != 'Active') {
        const tempFunc = await this.getFunction(ns, funcObject.FuncName)
        status = tempFunc.Status
        await utils.sleep(500)
      }
      this.context.debug('Updating configure... ')
      await this.updateConfiguration(ns, func, funcObject)
      return func
    }
    return null
  }

  async addRole() {
    try {
      const roleName = 'SCF_QcsRole'
      const policyName = 'QcloudAccessForScfRole'
      const listPoliciesModels = new camModels.ListPoliciesRequest()
      const listPoliciesHandler = util.promisify(this.camClient.ListPolicies.bind(this.camClient))
      let havePolicy = false
      let policyId
      let pagePolicyCount = 200
      const body = { Rp: 200, Page: 0 }
      while (!havePolicy && pagePolicyCount == 200) {
        body.Page = body.Page + 1
        listPoliciesModels.from_json_string(JSON.stringify(body))
        try {
          const pagePolicList = await listPoliciesHandler(listPoliciesModels)
          for (let i = 0; i < pagePolicList.List.length; i++) {
            if (policyName == pagePolicList.List[i].PolicyName) {
              havePolicy = true
              policyId = pagePolicList.List[i].PolicyId
              break
            }
          }
          pagePolicyCount = pagePolicList.List.length
        } catch (e) {
          pagePolicyCount = 0
        }
        await utils.sleep(400)
      }

      // Create role and attach policy
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
        const createRoleHandler = util.promisify(this.camClient.CreateRole.bind(this.camClient))
        await createRoleHandler(createRoleModels)
      } catch (e) {
        if (e && e.message.match('role name in use')) {
        } else {
          this.context.debug('Create role error : ' + e)
        }
      }
      try {
        const attachRolePolicyModels = new camModels.AttachRolePolicyRequest()
        const attachRolePolicyHandler = util.promisify(
          this.camClient.AttachRolePolicy.bind(this.camClient)
        )
        const attachRolePolicyBody = {
          AttachRoleName: roleName
        }
        try {
          attachRolePolicyBody.PolicyId = policyId
          attachRolePolicyModels.from_json_string(JSON.stringify(attachRolePolicyBody))
          await attachRolePolicyHandler(attachRolePolicyModels)
        } catch (e) {}
        await utils.sleep(400)
      } catch (e) {}
    } catch (e) {}
  }

  async updateFunctionCode(ns, funcObject) {
    const updateArgs = {
      Region: funcObject.Properties.Region,
      FunctionName: funcObject.FuncName,
      Handler: funcObject.Properties.Handler,
      Namespace: ns,
      CosBucketName: funcObject.Properties.CodeUri.Bucket,
      CosObjectName: '/' + funcObject.Properties.CodeUri.Key
    }
    const req = new models.UpdateFunctionCodeRequest()
    req.from_json_string(JSON.stringify(updateArgs))
    const handler = util.promisify(this.scfClient.UpdateFunctionCode.bind(this.scfClient))
    try {
      return await handler(req)
    } catch (e) {
      this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
      throw e
    }
  }

  async createFunction(ns, funcObject) {
    const createFuncRequest = {
      Region: funcObject.Properties.Region,
      FunctionName: funcObject.FuncName,
      Code: {
        CosBucketName: funcObject.Properties.CodeUri.Bucket,
        CosObjectName: '/' + funcObject.Properties.CodeUri.Key
      },
      Namespace: ns,
      Runtime: funcObject.Properties.Runtime,
      Handler: funcObject.Properties.Handler,
      Role: funcObject.Properties.Role,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Description: funcObject.Properties.Description
    }

    if (!_.isEmpty(funcObject.Properties.Environment)) {
      const env = funcObject.Properties.Environment

      createFuncRequest.Environment = {
        Variables: []
      }
      for (const key in env.Variables) {
        const item = {
          Key: key,
          Value: env.Variables[key]
        }
        createFuncRequest.Environment.Variables.push(item)
      }
    }

    if (!_.isEmpty(funcObject.Properties.VpcConfig)) {
      const vpc = funcObject.Properties.VpcConfig

      createFuncRequest.VpcConfig = {
        VpcId: vpc.VpcId,
        SubnetId: vpc.SubnetId
      }
    }
    const req = new models.CreateFunctionRequest()
    req.from_json_string(JSON.stringify(createFuncRequest))
    const handler = util.promisify(this.scfClient.CreateFunction.bind(this.scfClient))
    try {
      return await handler(req)
    } catch (e) {
      this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
      throw e
    }
  }

  async getFunction(ns, funcName, showCode) {
    const req = new models.GetFunctionRequest()
    const body = {
      FunctionName: funcName,
      Namespace: ns,
      ShowCode: showCode ? 'TRUE' : 'FALSE'
    }
    req.from_json_string(JSON.stringify(body))
    const handler = util.promisify(this.scfClient.GetFunction.bind(this.scfClient))
    try {
      return await handler(req)
    } catch (e) {
      if (e.code == 'ResourceNotFound.FunctionName' || e.code == 'ResourceNotFound.Function') {
        return null
      }
      this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
      throw e
    }
  }

  async updateConfiguration(ns, oldFunc, funcObject) {
    const configArgs = {
      Region: this.options.region,
      FunctionName: funcObject.FuncName,
      Namespace: ns,
      // Runtime: funcObject.Properties.Runtime, // Does not support modification
      Role: funcObject.Properties.Role,
      MemorySize: funcObject.Properties.MemorySize,
      Timeout: funcObject.Properties.Timeout,
      Description: funcObject.Properties.Description
    }

    if (!_.isEmpty(funcObject.Properties.Environment)) {
      const env = funcObject.Properties.Environment

      configArgs.Environment = {
        Variables: []
      }
      for (const key in env.Variables) {
        const item = {
          Key: key,
          Value: env.Variables[key]
        }
        configArgs.Environment.Variables.push(item)
      }
    }

    if (!_.isEmpty(funcObject.Properties.VpcConfig)) {
      const vpc = funcObject.Properties.VpcConfig
      configArgs.VpcConfig = {
        VpcId: vpc.VpcId,
        SubnetId: vpc.SubnetId
      }
    }

    if (!_.isEmpty(configArgs)) {
      const req = new models.UpdateFunctionConfigurationRequest()
      req.from_json_string(JSON.stringify(configArgs))
      const handler = util.promisify(
        this.scfClient.UpdateFunctionConfiguration.bind(this.scfClient)
      )
      try {
        await handler(req)
      } catch (e) {
        this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
        throw e
      }
    }
  }

  async uploadPackage2Cos(bucketName, key, filePath) {
    let handler
    const { region } = this.options
    const cosBucketNameFull = util.format('%s-%s', bucketName, this.appid)

    // get region all bucket list
    let buckets
    handler = util.promisify(this.cosClient.getService.bind(this.cosClient))
    try {
      buckets = await handler({ Region: region })
    } catch (e) {
      throw e
    }

    const findBucket = _.find(buckets.Buckets, (item) => {
      if (item.Name == cosBucketNameFull) {
        return item
      }
    })

    // create a new bucket
    if (_.isEmpty(findBucket)) {
      const putArgs = {
        Bucket: cosBucketNameFull,
        Region: region
      }
      handler = util.promisify(this.cosClient.putBucket.bind(this.cosClient))
      try {
        await handler(putArgs)
      } catch (e) {
        throw e
      }
    }

    if (fs.statSync(filePath).size <= 20 * 1024 * 1024) {
      const objArgs = {
        Bucket: cosBucketNameFull,
        Region: region,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: fs.statSync(filePath).size
      }
      handler = util.promisify(this.cosClient.putObject.bind(this.cosClient))
      try {
        await handler(objArgs)
      } catch (e) {
        throw e
      }
    } else {
      const sliceArgs = {
        Bucket: cosBucketNameFull,
        Region: region,
        Key: key,
        FilePath: filePath
      }
      handler = util.promisify(this.cosClient.sliceUploadFile.bind(this.cosClient))
      try {
        await handler(sliceArgs)
      } catch (e) {
        throw e
      }
    }
    return {
      CosBucketName: bucketName,
      CosObjectName: '/' + key
    }
  }

  async createTags(ns, funcName, tags) {
    let handler
    if (_.isEmpty(tags)) {
      return
    }
    const func = await this.getFunction(ns, funcName)
    if (!func) {
      throw new Error(`Function ${funcName} dont't exists`)
    }
    const resource = util.format('qcs::scf:%s::lam/%s', this.options.region, func.FunctionId)
    const req = {
      Resource: resource,
      ReplaceTags: [],
      DeleteTags: []
    }
    const findRequest = {
      ResourceRegion: this.options.region,
      ResourceIds: [func.FunctionId],
      ResourcePrefix: 'lam',
      ServiceType: 'scf',
      Limit: 1000
    }
    let result
    handler = util.promisify(this.tagClient.DescribeResourceTagsByResourceIds.bind(this.tagClient))
    try {
      result = await handler(findRequest)
    } catch (e) {
      throw e
    }
    const len = _.size(result.Tags)
    for (let i = 0; i < len; i++) {
      const oldTag = result.Tags[i]
      const ret = _.find(tags, (value, key) => {
        if (oldTag.TagKey == key) {
          return true
        }
      })
      if (!ret) {
        req.DeleteTags.push({
          TagKey: oldTag.TagKey
        })
      }
    }

    for (const key in tags) {
      req.ReplaceTags.push({
        TagKey: key,
        TagValue: tags[key]
      })
    }
    handler = util.promisify(this.tagClient.ModifyResourceTags.bind(this.tagClient))
    try {
      await handler(req)
    } catch (e) {
      throw e
    }
  }
}

module.exports = DeployFunction
