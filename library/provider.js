class Provider {
  constructor(inputs, prefix) {
    this.inputs = inputs
    this.prefix = prefix || 'sls-cloudfunction'
  }

  get region() {
    return this.inputs.region || 'ap-guangzhou'
  }

  getFuntionBucketKey(ns, functionName) {
    const nowDate = new Date()
    const timestamp = parseInt(nowDate.getTime() / 1000)
    return this.prefix + '-' + ns + '-' + functionName + '-' + timestamp + '.zip'
  }

  getEnvironment(funcObject) {
    const funcObjectInfo = funcObject.environment
    if (funcObjectInfo && funcObjectInfo.variables) {
      return { Variables: funcObject.environment.variables }
    }
    return null
  }

  getVPCConfig(funcObject) {
    const funcObjectInfo = funcObject.vpcConfig
    const vpcId = funcObjectInfo && funcObjectInfo.vpcId ? funcObjectInfo.vpcId : ''
    const subnetId = funcObjectInfo && funcObjectInfo.subnetId ? funcObjectInfo.subnetId : ''
    return { VpcId: vpcId, SubnetId: subnetId }
  }

  getCosBucketNme(name) {
    return this.prefix + '-' + this.region + '-' + (name ? name : 'code')
  }

  getFunctionResource(funcObject, functionName) {
    const functionResource = {
      Type: 'TencentCloud::Serverless::Function',
      Properties: {
        CodeUri: {
          Bucket: this.getCosBucketNme(),
          Key: this.getFuntionBucketKey(this.namespace, functionName)
        },
        Type: 'Event',
        Description: funcObject.description || 'This is a template function',
        Role: funcObject.role || 'QCS_SCFExcuteRole',
        Handler: funcObject.handler || 'index.main_handler',
        MemorySize: funcObject.memorySize || 128,
        Timeout: funcObject.timeout || 3,
        Region: funcObject.region || 'ap-guangzhou',
        Runtime: funcObject.runtime || 'Nodejs8.9'
      }
    }

    const vpcConfig = this.getVPCConfig(funcObject)
    if (vpcConfig) {
      functionResource['Properties']['VpcConfig'] = vpcConfig
    }

    const environment = this.getEnvironment(funcObject)
    if (environment) {
      functionResource['Properties']['Environment'] = environment
    }

    return functionResource
  }

  get namespace() {
    return 'default'
  }

  getServiceResource() {
    var functionInfo = {
      Type: 'TencentCloud::Serverless::Namespace'
    }
    functionInfo[this.inputs.name] = this.getFunctionResource(this.inputs, this.inputs.name)
    return {
      Resources: {
        default: functionInfo
      }
    }
  }
}

module.exports = Provider
