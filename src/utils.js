const download = require('download')
const { Cos } = require('tencent-component-toolkit')
const { ApiTypeError } = require('tencent-component-toolkit/lib/utils/error')
const CONFIGS = require('./config')

/**
 * Generate random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

const getType = (obj) => {
  return Object.prototype.toString.call(obj).slice(8, -1)
}

const removeAppid = (str, appid) => {
  const suffix = `-${appid}`
  if (!str || str.indexOf(suffix) === -1) {
    return str
  }
  return str.slice(0, -suffix.length)
}

const validateTraffic = (num) => {
  if (getType(num) !== 'Number') {
    throw new ApiTypeError(
      `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
      'traffic must be a number'
    )
  }
  if (num < 0 || num > 1) {
    throw new ApiTypeError(
      `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
      'traffic must be a number between 0 and 1'
    )
  }
  return true
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

const getDefaultServiceDescription = (instance) => {
  return `The service of serverless scf: ${instance.name}-${instance.stage}-${instance.app}`
}

/**
 * get default template zip file path
 */
const getDefaultZipPath = async () => {
  // unzip source zip file
  // add default template
  const downloadPath = `/tmp/${generateId()}`
  const filename = 'template'

  console.log(`Installing Default ${CONFIGS.compFullname} code...`)
  try {
    await download(CONFIGS.templateUrl, downloadPath, {
      filename: `${filename}.zip`
    })
  } catch (e) {
    throw new ApiTypeError(
      `DOWNLOAD_${CONFIGS.compName.toUpperCase()}_TEMPLATE`,
      'Download default template failed.'
    )
  }
  const zipPath = `${downloadPath}/${filename}.zip`

  return zipPath
}

async function uploadCodeToCos(instance, credentials, appId, inputs) {
  const region = inputs.region || CONFIGS.region

  inputs.srcOriginal = inputs.srcOriginal || inputs.src

  const tempSrc =
    typeof inputs.srcOriginal === 'object'
      ? inputs.srcOriginal
      : typeof inputs.srcOriginal === 'string'
      ? {
          src: inputs.srcOriginal
        }
      : {}

  const bucketName = removeAppid(tempSrc.bucket, appId) || `sls-cloudfunction-${region}-code`
  const objectName =
    tempSrc.object ||
    `/${CONFIGS.compName}_component_${generateId()}-${Math.floor(Date.now() / 1000)}.zip`

  const code = {
    bucket: bucketName,
    object: objectName
  }
  const cos = new Cos(credentials, region)
  const bucket = `${code.bucket}-${appId}`

  // create new bucket, and setup lifecycle for it
  if (!tempSrc.bucket) {
    await cos.deploy({
      bucket: `${bucketName}-${appId}`,
      force: true,
      lifecycle: [
        {
          status: 'Enabled',
          id: 'deleteObject',
          filter: '',
          expiration: { days: '10' },
          abortIncompleteMultipartUpload: { daysAfterInitiation: '10' }
        }
      ]
    })
  }

  let useDefault
  if (!tempSrc.object) {
    // whether use default template, if so, download it
    // get default template code
    let zipPath
    if (!tempSrc.src) {
      useDefault = true
      zipPath = await getDefaultZipPath()
      inputs.src = zipPath
    } else {
      zipPath = inputs.src
    }
    console.log(`Uploading code ${code.object} to bucket ${bucket}`)
    await cos.upload({
      bucket: `${bucketName}-${appId}`,
      file: zipPath,
      key: objectName
    })
  }

  return {
    code,
    useDefault
  }
}

/**
 * prepare scf deploy input parameters
 * @param {Component} instance serverless component
 * @param {object} credentials component credentials
 * @param {string} appId app id
 * @param {object} inputs yml inputs
 */
const formatInputs = async (instance, credentials, appId, inputs) => {
  // 基于镜像部署
  let imageCode
  if (inputs.image) {
    const imageConfig = inputs.image
    // 企业版需要配置 registryName (实例名称)
    if (imageConfig.registryId) {
      imageCode = {
        imageType: 'enterprise',
        imageUri: imageConfig.imageUri,
        registryId: imageConfig.registryId,
        command: imageConfig.command,
        args: imageConfig.args
      }
    } else {
      imageCode = {
        imageType: imageConfig.imageType || 'personal',
        imageUri: imageConfig.imageUri,
        command: imageConfig.command,
        args: imageConfig.args
      }
    }
  }

  let useDefault = false
  if (imageCode) {
    inputs.imageConfig = imageCode
  } else {
    const uploadResult = await uploadCodeToCos(instance, credentials, appId, inputs)
    inputs.code = uploadResult.code
    ;({ useDefault } = uploadResult)

    inputs.runtime = inputs.runtime || CONFIGS.runtime
    inputs.handler = inputs.handler || CONFIGS.handler(inputs.runtime)
  }

  const oldState = instance.state
  inputs.name =
    inputs.name ||
    (oldState.function && oldState.function.FunctionName) ||
    getDefaultFunctionName(instance)
  inputs.description = inputs.description || CONFIGS.description(instance.app)
  inputs.events = inputs.events || []

  const stateApigw = oldState.apigw
  const triggers = {}
  const apigwName = []

  let existApigwTrigger = false
  // initial apigw event parameters
  inputs.events = inputs.events.map((event) => {
    const eventType = Object.keys(event)[0]
    // check trigger type
    if (CONFIGS.triggerTypes.indexOf(eventType) === -1) {
      throw new ApiTypeError(
        `PARAMETER_${CONFIGS.compName.toUpperCase()}_APIGW_TRIGGER`,
        `Unknow trigger type ${eventType}, must be one of ${JSON.stringify(CONFIGS.triggerTypes)}`
      )
    }
    const currentEvent = event[eventType]
    triggers[eventType] = triggers[eventType] || []

    if (eventType === 'apigw') {
      if (apigwName.includes(currentEvent.name)) {
        throw new ApiTypeError(
          `PARAMETER_${CONFIGS.compName.toUpperCase()}_APIGW_TRIGGER`,
          `API Gateway name must be unique`
        )
      } else {
        const serviceName =
          currentEvent.parameters.serviceName ||
          currentEvent.name ||
          getDefaultServiceName(instance)

        let { serviceId } = currentEvent.parameters
        currentEvent.parameters.isInputServiceId = !!serviceId
        currentEvent.parameters.serviceName = serviceName
        currentEvent.parameters.description =
          currentEvent.parameters.description || getDefaultServiceDescription(instance)
        currentEvent.name = currentEvent.name || getDefaultTriggerName(eventType, instance)
        // 用户并未配置 serviceId, 此处通过 serviceName 来查询储存的 apigw 触发器状态数据
        // 用户并配置 serviceId, 此处通过 serviceId 来查询储存的 apigw 触发器状态数据
        let curState = stateApigw && stateApigw[serviceName]
        if (!curState) {
          curState = stateApigw && stateApigw[serviceId]
        }
        if (curState) {
          currentEvent.parameters.oldState = curState
          serviceId = serviceId || curState.serviceId
          currentEvent.parameters.created = curState.created
        }
        currentEvent.parameters.serviceId = serviceId
        apigwName.push(serviceName)
      }
      existApigwTrigger = true
    } else {
      currentEvent.name = currentEvent.name || getDefaultTriggerName(eventType, instance)
      triggers[eventType].push(currentEvent.name)
    }
    return event
  })

  // if not config apig trigger, and autoCreateApi is true
  if (inputs.autoCreateApi && !existApigwTrigger) {
    triggers.apigw = []
    const { defaultApigw } = CONFIGS
    const serviceName = getDefaultServiceName(instance)
    defaultApigw.parameters.serviceName = serviceName
    defaultApigw.parameters.description = getDefaultServiceDescription(instance)
    if (stateApigw && stateApigw[serviceName]) {
      defaultApigw.parameters.oldState = stateApigw[serviceName]
      defaultApigw.parameters.serviceId =
        defaultApigw.parameters.serviceId || stateApigw[serviceName].serviceId
      defaultApigw.parameters.created = stateApigw[serviceName].created
    }
    if (inputs.type === 'web') {
      defaultApigw.parameters.function = {
        type: 'web'
      }
    }
    inputs.events.push({
      apigw: defaultApigw
    })

    existApigwTrigger = true
  }

  // validate traffic config
  if (inputs.traffic !== undefined) {
    validateTraffic(inputs.traffic)
  }

  inputs.lastVersion = instance.state.lastVersion

  return {
    useDefault,
    existApigwTrigger,
    scfInputs: inputs,
    triggers
  }
}

const formatAliasInputs = (inputs) => {
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

function formatNumber(num) {
  return num > 9 ? num : `0${num}`
}

function formatDate(timestamp) {
  const dStr = `${timestamp}`.length === 10 ? timestamp * 1000 : timestamp
  const d = new Date(dStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours()
  const minute = d.getMinutes()
  const second = d.getSeconds()

  return `${year}-${formatNumber(month)}-${formatNumber(day)} ${formatNumber(hour)}:${formatNumber(
    minute
  )}:${formatNumber(second)}`
}

function formatMetricData(data) {
  const { DataPoints = [] } = data
  const list = []
  DataPoints.forEach((point) => {
    const { Timestamps = [], Values = [] } = point
    Timestamps.forEach((time, i) => {
      list.push({
        time: formatDate(time),
        value: Values[i],
        timestamp: time
      })
    })
  })

  return list
}

module.exports = {
  getType,
  getDefaultProtocol,
  generateId,
  getDefaultZipPath,
  formatInputs,
  formatAliasInputs,
  formatMetricData
}
