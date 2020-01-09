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
    if (vpcId && subnetId) {
      return { VpcId: vpcId, SubnetId: subnetId }
    }
    return null
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
        Role: funcObject.role,
        Handler: funcObject.handler || 'index.main_handler',
        MemorySize: funcObject.memorySize || 128,
        Timeout: funcObject.timeout || 3,
        Region: funcObject.region || 'ap-guangzhou',
        Runtime: funcObject.runtime || 'Nodejs8.9',
        Tags: {
          CLI: 'Serverless'
        }
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

  getTimerEvent(event) {
    const trigger = {}
    if (!event.parameters.cronExpression) {
      throw new Error('Specify timer trigger cronexpression must be filled in.')
    }
    trigger[event.name] = {
      Type: 'Timer',
      Properties: {
        CronExpression: event.parameters.cronExpression,
        Enable: event.parameters.enable
      }
    }
    return trigger
  }

  getCOSEvent(event) {
    const trigger = {}
    const filter = {
      Prefix:
        event.parameters.filter && event.parameters.filter.prefix
          ? event.parameters.filter.prefix
          : '',
      Suffix:
        event.parameters.filter && event.parameters.filter.suffix
          ? event.parameters.filter.suffix
          : ''
    }

    trigger[event.name] = {
      Type: 'COS',
      Properties: {
        Bucket: event.parameters.bucket,
        Events: event.parameters.events,
        Enable: event.parameters.enable,
        Filter: filter
      }
    }
    return trigger
  }

  getAPIGWEvent(event, funcObject, functionName) {
    const trigger = {}
    const endpoints = new Array()
    event.parameters.region = funcObject.region || 'ap-guangzhou'
    for (let i = 0; i < event.parameters.endpoints.length; i++) {
      const endpoint = event.parameters.endpoints[i]
      if (endpoint.function) {
        endpoint.function['functionName'] = functionName
      } else {
        endpoint['function'] = {
          functionName: functionName
        }
      }
      endpoints.push(endpoint)
    }
    event.parameters.serviceName = event.name
    event.parameters.endpoints = endpoints
    trigger[event.name] = {
      Type: 'APIGW',
      Properties: event.parameters
    }
    return trigger
  }

  getCMQEvent(event) {
    const trigger = {}
    trigger[event.name] = {
      Type: 'CMQ',
      Properties: {
        Name: event.parameters.name,
        Enable: event.parameters.enable
      }
    }
    return trigger
  }

  getCkafkaEvent(event) {
    const trigger = {}
    trigger[event.name] = {
      Type: 'Ckafka',
      Properties: {
        Name: event.parameters.name,
        Topic: event.parameters.topic,
        MaxMsgNum: event.parameters.maxMsgNum,
        Offset: event.parameters.offset,
        Enable: event.parameters.enable
      }
    }
    return trigger
  }

  get namespace() {
    return 'default'
  }

  getServiceResource() {
    var functionInfo = {
      Type: 'TencentCloud::Serverless::Namespace'
    }
    const eventList = new Array()
    const funcObject = this.inputs
    const funtionResource = this.getFunctionResource(this.inputs, this.inputs.name)
    if (funcObject.events) {
      for (var eventIndex = 0; eventIndex < funcObject.events.length; eventIndex++) {
        const event = funcObject.events[eventIndex]
        const eventType = Object.keys(event)[0]
        if (eventType === 'timer') {
          const triggerResource = this.getTimerEvent(event.timer)
          eventList.push(triggerResource)
        } else if (eventType === 'cos') {
          const triggerResource = this.getCOSEvent(event.cos)
          eventList.push(triggerResource)
        } else if (eventType === 'apigw') {
          const triggerResource = this.getAPIGWEvent(event.apigw, funcObject, this.inputs.name)
          eventList.push(triggerResource)
        } else if (eventType === 'ckafka') {
          const triggerResource = this.getCkafkaEvent(event.ckafka)
          eventList.push(triggerResource)
        } else if (eventType === 'cmq') {
          const triggerResource = this.getCMQEvent(event.cmq)
          eventList.push(triggerResource)
        }
      }
      funtionResource['Properties']['Events'] = eventList
    }
    functionInfo[this.inputs.name] = funtionResource
    return {
      Resources: {
        default: functionInfo
      }
    }
  }
}

module.exports = Provider
