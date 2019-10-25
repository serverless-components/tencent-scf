const tencentcloud = require('tencentcloud-sdk-nodejs')
const Abstract = require('./abstract')
const fs = require('fs')
const _ = require('lodash')
const util = require('util')
const models = tencentcloud.scf.v20180416.Models
const ScfUploadSliceLimit = 8 * 1024 * 1024

class DeployFunction extends Abstract {
  constructor(appid, secret_id, secret_key, options) {
    super(appid, secret_id, secret_key, options)
  }

  async deploy(ns, funcObject) {
    const func = await this.getFunction(ns, funcObject.FuncName)
    if (!func) {
      await this.createFunction(ns, funcObject)
    } else {
      if (func.Runtime != funcObject.Properties.Runtime) {
        throw 'Runtime could not be changed! '
      }
      await this.updateFunctionCode(ns, funcObject)
      await this.updateConfiguration(ns, func, funcObject)
      return func
    }
    return null
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
      console.log('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
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
        VpcId: vpc.vpcId,
        SubnetId: vpc.subnetId
      }
    }
    const req = new models.CreateFunctionRequest()
    req.from_json_string(JSON.stringify(createFuncRequest))
    const handler = util.promisify(this.scfClient.CreateFunction.bind(this.scfClient))
    try {
      return await handler(req)
    } catch (e) {
      console.log('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
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
      console.log('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
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
        VpcId: vpc.vpcId,
        SubnetId: vpc.subnetId
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
        console.log('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
        throw e
      }
    }
  }

  async uploadPackage2Cos(bucketName, key, filePath) {
    const region = this.options.region
    const cosBucketNameFull = util.format('%s-%s', bucketName, this.appid)

    // get region all bucket list
    let buckets
    const handler = util.promisify(this.cosClient.getService.bind(this.cosClient))
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

    let result
    // create a new bucket
    if (_.isEmpty(findBucket)) {
      const putArgs = {
        Bucket: cosBucketNameFull,
        Region: region
      }
      const handler = util.promisify(this.cosClient.putBucket.bind(this.cosClient))
      try {
        await handler(putArgs)
      } catch (e) {
        throw e
      }
    }

    if (fs.statSync(filePath).size <= ScfUploadSliceLimit) {
      const objArgs = {
        Bucket: cosBucketNameFull,
        Region: region,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: fs.statSync(filePath).size
      }
      const handler = util.promisify(this.cosClient.putObject.bind(this.cosClient))
      try {
        result = await handler(objArgs)
      } catch (e) {
        throw e
      }
    } else {
      const sliceArgs = {
        Bucket: cosBucketNameFull,
        Region: region,
        Key: key,
        FilePath: filePath,
        onTaskReady: function(taskId) {},
        onProgress: function(progressData) {}
      }
      const handler = util.promisify(this.cosClient.sliceUploadFile.bind(this.cosClient))
      try {
        result = await handler(sliceArgs)
      } catch (e) {
        throw e
      }
    }
    return {
      CosBucketName: bucketName,
      CosObjectName: '/' + key
    }
  }
}

module.exports = DeployFunction
