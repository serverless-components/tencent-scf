/**
 this class function getServiceResource() output the object
 {
    "Service": "",
    "Stage": "",
    "ServiceFileName": "fileName.json",
    "ServiceZipName": "fileName.zip",
    "CreateTime": "2019-10-17T19:46:22.473Z",
    "CreateTimestamp": 1571341582,
    "Resources": {
        "default": {
            "Type": "TencentCloud::Serverless::Namespace",
            "my-6function": {
                "Type": "TencentCloud::Serverless::Function",
                "Properties": {
                    "CodeUri": {
                        "Bucket": "my-deployment-bucket",
                        "Key": "fileName.zip"
                    },
                    "Type": "Event",
                    "Description": "the Description",
                    "Role": "QCS_SCFExcuteRole",
                    "Handler": "handler.hello",
                    "MemorySize": 128,
                    "Timeout": 20,
                    "Region": "us-east-1",
                    "Runtime": "Nodejs8.10",
                    "Tags": {
                        "key1": "val1",
                        "key2": "val2",
                    },
                    "VpcConfig": {
                        "VpcId": "",
                        "SubnetId": ""
                    },
                    "Environment": {
                        "Variables": {
                            "key1": "val1",
                            "key2": "val2",
                        }
                    }
                }
            }
        }
    }
}
 */

class Provider {
  constructor(inputs, prefix) {
    this.inputs = inputs
    this.prefix = prefix || 'sls-cloudfunction'
  }

  getFunctionName(functionName) {
    return functionName
  }

  randomString() {
    const len = 6
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'
    const maxPos = chars.length
    let result = ''
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * maxPos))
    }
    return result
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

  getFunctionResource(funcObject, functionName, serviceStr, keyTime) {
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
    var functionList = {
      Type: 'TencentCloud::Serverless::Namespace'
    }
    const serviceStr = this.randomString()
    const date = new Date()
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset()) // toJSON 的时区补偿
    const keyTime = date
      .toJSON()
      .substr(0, 19)
      .replace(/[:T]/g, '-')
    const funcObject = this.inputs
    const functionName = this.getFunctionName(funcObject.name)
    const funtionResource = this.getFunctionResource(funcObject, functionName, serviceStr, keyTime)
    functionList[functionName] = funtionResource

    const resource = {
      Resources: {}
    }

    resource['Resources']['default'] = functionList
    return resource
  }
}

module.exports = Provider
