const download = require('download')
const { Cos } = require('tencent-component-toolkit')
const { TypeError } = require('tencent-component-toolkit/src/utils/error')
const { typeOf, deepClone } = require('@ygkit/object')

/**
 * Generate random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

const validateTraffic = (framework, num) => {
  if (typeOf(num) !== 'Number') {
    throw new TypeError(`PARAMETER_${framework.toUpperCase()}_TRAFFIC`, 'traffic must be a number')
  }
  if (num < 0 || num > 1) {
    throw new TypeError(
      `PARAMETER_${framework.toUpperCase()}_TRAFFIC`,
      'traffic must be a number between 0 and 1'
    )
  }
  return true
}

const getTimestamp = () => {
  return Math.floor(Date.now() / 1000)
}

const getDefaultProtocol = (protocols) => {
  return String(protocols).includes('https') ? 'https' : 'http'
}

const getDefaultFunctionName = (instance) => {
  return `${instance.name}-${instance.stage}-${instance.app}`
}

const getDefaultTriggerName = (type, instance) => {
  return `${type}-${instance.name}-${instance.stage}`
}

const getDefaultServiceName = () => {
  return 'serverless'
}

const getDefaultBucketName = (region) => {
  return `serverless-${region}-code`
}

const getDefaultObjectName = (inputs) => {
  return `${inputs.name}-${getTimestamp()}.zip`
}

const getDefaultServiceDescription = (instance) => {
  return `The service of serverless scf: ${instance.name}-${instance.stage}-${instance.app}`
}

const removeAppid = (str, appId) => {
  const suffix = `-${appId}`
  if (!str || str.indexOf(suffix) === -1) {
    return str
  }
  return str.slice(0, -suffix.length)
}

const formatCosTriggerBucket = (bucket, region, appId) => {
  const suffix = `.cos.${region}.myqcloud.com`
  if (bucket.indexOf(suffix) !== -1) {
    return bucket
  }
  const bucketName = removeAppid(bucket, appId)
  return `${bucketName}-${appId}${suffix}`
}

const getCodeZipPath = async (instance, inputs) => {
  const { CONFIGS, framework } = instance
  console.log(`Packaging ${framework} application`)

  // unzip source zip file
  let zipPath
  if (!inputs.code.src) {
    // add default template
    const downloadPath = `/tmp/${generateId()}`
    const filename = 'template'

    console.log(`Downloading default ${framework} application`)
    try {
      await download(CONFIGS.templateUrl, downloadPath, {
        filename: `${filename}.zip`
      })
    } catch (e) {
      throw new TypeError(`DOWNLOAD_TEMPLATE`, 'Download default template failed.')
    }
    zipPath = `${downloadPath}/${filename}.zip`
  } else {
    zipPath = inputs.code.src
  }

  return zipPath
}

/**
 * Upload code to COS
 * @param {Component} instance serverless component instance
 * @param {string} appId app id
 * @param {object} credentials credentials
 * @param {object} inputs component inputs parameters
 * @param {string} region region
 */
const uploadCodeToCos = async (instance, appId, credentials, inputs, region) => {
  const { CONFIGS } = instance
  const bucketName = inputs.code.bucket || getDefaultBucketName(region)
  const objectName = inputs.code.object || getDefaultObjectName(inputs)
  const bucket = `${bucketName}-${appId}`

  const zipPath = await getCodeZipPath(instance, inputs)
  console.log(`Code zip path ${zipPath}`)

  // save the zip path to state for lambda to use it
  instance.state.zipPath = zipPath

  const cos = new Cos(credentials, region)

  if (!inputs.code.bucket) {
    // create default bucket
    await cos.deploy({
      force: true,
      bucket: bucketName + '-' + appId,
      lifecycle: CONFIGS.cos.lifecycle
    })
  }
  if (!inputs.code.object) {
    console.log(`Getting cos upload url for bucket ${bucketName}`)
    const uploadUrl = await cos.getObjectUrl({
      bucket: bucket,
      object: objectName,
      method: 'PUT'
    })

    // if shims and sls sdk entries had been injected to zipPath, no need to injected again
    console.log(`Uploading code to bucket ${bucketName}`)

    await instance.uploadSourceZipToCOS(zipPath, uploadUrl, {}, {})
    console.log(`Upload ${objectName} to bucket ${bucketName} success`)
  }

  // save bucket state
  instance.state.bucket = bucketName
  instance.state.object = objectName

  return {
    bucket: bucketName,
    object: objectName
  }
}

const yamlToSdkInputs = (inputs, region, appId) => {
  const sdkInputs = deepClone(inputs)
  if (sdkInputs.triggers) {
    sdkInputs.triggers = sdkInputs.triggers.map((trigger) => {
      if (trigger.type === 'apigw') {
        if (trigger.apis) {
          trigger.apis = trigger.apis.map((api) => {
            api.apiId = api.id
            api.apiName = api.name
            api.enableCORS = api.cors
            api.apiDesc = api.description
            api.serviceTimeout = api.timeout
          })
        }
      }
      if (trigger.type === 'cos') {
        // format bucket
        trigger.bucket = formatCosTriggerBucket(trigger.bucket, region, appId)
      }
    })
  }
  return sdkInputs
}

/**
 * prepare scf deploy input parameters
 * @param {Component} instance serverless component
 * @param {object} credentials component credentials
 * @param {string} appId app id
 * @param {object} inputs yml inputs
 */
const initializeInputs = async (instance, inputs, appId) => {
  const { CONFIGS, framework } = instance
  const region = inputs.region || CONFIGS.region

  inputs.code = {
    src: inputs.src && inputs.src.src,
    bucket: inputs.srcOriginal && inputs.srcOriginal.bucket,
    object: inputs.srcOriginal && inputs.srcOriginal.object
  }

  const oldState = instance.state
  const stateFaasName = oldState.function && oldState.function.FunctionName
  inputs.name = inputs.name || stateFaasName || getDefaultFunctionName(instance)
  inputs.runtime = inputs.runtime || CONFIGS.runtime
  inputs.handler = inputs.handler || CONFIGS.handler(inputs.runtime)
  inputs.description = inputs.description || CONFIGS.description(instance.app)

  const stateApigw = oldState.apigw
  const outputTriggers = {}
  const apigwName = []

  let existApigwTrigger = false
  // initial apigw event parameters
  inputs.triggers = (inputs.triggers || []).map((currentEvent) => {
    const eventType = currentEvent.type
    // check trigger type
    if (CONFIGS.triggerTypes.indexOf(eventType) === -1) {
      throw new TypeError(
        `PARAMETER_${framework.toUpperCase()}_APIGW_TRIGGER`,
        `Unknow trigger type ${eventType}, must be one of ${JSON.stringify(CONFIGS.triggerTypes)}`
      )
    }
    outputTriggers[eventType] = outputTriggers[eventType] || []

    if (eventType === 'apigw') {
      if (apigwName.includes(currentEvent.name)) {
        throw new TypeError(
          `PARAMETER_${framework.toUpperCase()}_APIGW_TRIGGER`,
          `API Gateway name must be unique`
        )
      } else {
        currentEvent.name = currentEvent.name || getDefaultServiceName(instance)
        currentEvent.description =
          currentEvent.description || getDefaultServiceDescription(instance)
        if (stateApigw && stateApigw[currentEvent.name]) {
          currentEvent.oldState = stateApigw[currentEvent.name]
          currentEvent.id = currentEvent.id || stateApigw[currentEvent.name]
        }
        apigwName.push(currentEvent.name)
      }
      existApigwTrigger = true
    } else {
      currentEvent.name = currentEvent.name || getDefaultTriggerName(eventType, instance)
      outputTriggers[eventType].push(currentEvent.name)
    }
    return currentEvent
  })

  // if not config apig trigger, and make autoCreateApi true
  if (inputs.autoCreateApi && !existApigwTrigger) {
    outputTriggers.apigw = []
    const { defaultApigw } = CONFIGS
    const serviceName = getDefaultServiceName(instance)
    defaultApigw.name = serviceName
    defaultApigw.description = getDefaultServiceDescription(instance)
    if (stateApigw && stateApigw[serviceName]) {
      defaultApigw.oldState = stateApigw[serviceName]
      defaultApigw.id = defaultApigw.id || stateApigw[serviceName].id
      defaultApigw.created = stateApigw[serviceName].created
    }
    inputs.triggers.push(defaultApigw)

    existApigwTrigger = true
  }

  // validate traffic config
  if (inputs.traffic !== undefined) {
    validateTraffic(framework, inputs.traffic)
  }

  inputs.lastVersion = instance.state.lastVersion

  return {
    outputTriggers,
    existApigwTrigger,
    scfInputs: yamlToSdkInputs(inputs, region, appId)
  }
}

const initializeAliasInputs = (inputs) => {
  const outputs = {}

  if (typeof inputs.name == 'undefined') {
    outputs.isPramasError = true
    outputs.message = 'The parameter "name" is missing'
    return outputs
  } else if (typeof inputs.name != 'string') {
    outputs.isPramasError = true
    outputs.message = 'The type of parameter "name" is string'
    return outputs
  }

  if (typeof inputs.function == 'undefined') {
    outputs.isPramasError = true
    outputs.message = 'The parameter "function" is missing'
    return outputs
  } else if (typeof inputs.function != 'string') {
    outputs.isPramasError = true
    outputs.message = 'The type of parameter "function" is string'
    return outputs
  }

  if (typeof inputs.version == 'undefined') {
    outputs.isPramasError = true
    outputs.message = 'The parameter "version" is missing'
    return outputs
  } else if (typeof inputs.version != 'number' && typeof inputs.version != 'string') {
    outputs.isPramasError = true
    outputs.message = 'The type of parameter "version" is number or string'
    return outputs
  }

  if (!inputs.namespace) {
    inputs.namespace = 'default'
  } else if (typeof inputs.namespace != 'string') {
    outputs.isPramasError = true
    outputs.message = 'The type of parameter "namespace" is string'
    return outputs
  }

  if (!inputs.description) {
    inputs.description = ''
  } else if (typeof inputs.description != 'string') {
    outputs.isPramasError = true
    outputs.message = 'The type of parameter "description" is string'
    return outputs
  }

  if (typeof inputs.config == 'undefined') {
    outputs.isPramasError = true
    outputs.message = 'The parameter "config" is missing'
    return outputs
  } else if (typeof inputs.config != 'object') {
    outputs.isPramasError = true
    outputs.message =
      'The parameter "config" is not illegal. The right format is like that：config=\'{"weights":{"2":0.1}}\''
    return outputs
  }

  if (typeof inputs.config.weights != 'object') {
    outputs.isPramasError = true
    outputs.message =
      'The parameter "config" is not illegal. The right format is like that：config=\'{"weights":{"2":0.1}}\''
    return outputs
  }

  let lastVersion, traffic
  try {
    lastVersion = Object.keys(inputs.config.weights)[0]
    traffic = Object.values(inputs.config.weights)[0]
  } catch (e) {
    outputs.isPramasError = true
    outputs.message =
      'The parameter "config" is not illegal. The right format is like that：config=\'{"weights":{"2":0.1}}\''
    return outputs
  }

  outputs.isPramasError = false
  outputs.aliasName = inputs.name
  outputs.functionName = inputs.function
  outputs.namespace = inputs.namespace
  outputs.functionVersion = inputs.version
  outputs.description = inputs.description
  outputs.lastVersion = lastVersion
  outputs.traffic = traffic

  return outputs
}

module.exports = {
  getDefaultProtocol,
  generateId,
  uploadCodeToCos,
  initializeInputs,
  initializeAliasInputs
}
