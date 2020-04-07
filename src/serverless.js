const {Component} = require('@serverless/core')
const ensureObject = require('type/object/ensure')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const Cam = require('tencent-cloud-sdk').cam
const {Scf, Cos} = require('tencent-component-toolkit')

class Express extends Component {
  async getUserInfo(credentials) {
    const cam = new Cam(credentials)
    return await cam.request({
      Action: 'GetUserAppId',
      Version: '2019-01-16'
    })
  }

  getDefaultProtocol(protocols) {
    if (String(protocols).includes('https')) {
      return 'https'
    }
    return 'http'
  }

  async deploy(inputs) {
    console.log(`Deploying Tencent Serverless Cloud Funtion Tencent (SCF) ...`)

    // 获取腾讯云密钥信息
    const credentials = this.credentials.tencent

    // 默认值
    const region = inputs.region || "ap-guangzhou"
    const userInfo = await this.getUserInfo(credentials)

    const code = {}

    code.bucket = inputs.src.bucket ? inputs.src.bucket : `sls-cloudfunction-${region}-code`
    code.object = inputs.src.object ? inputs.src.object : `/${inputs.name}-${Math.floor(Date.now() / 1000)}.zip`

    // 创建cos对象
    const cos = new Cos(credentials, region)
    // 创建存储桶 + 设置生命周期
    if (!inputs.src.bucket) {
      await cos.deploy({
        bucket: code.bucket + '-' + userInfo.Response.AppId,
        force: true,
        lifecycle: [
          {
            status: 'Enabled',
            id: 'deleteObject',
            filter: '',
            expiration: {days: '10'},
            abortIncompleteMultipartUpload: {daysAfterInitiation: '10'}
          }
        ]
      })
    }

    // 上传代码
    if (!inputs.src.object) {
      await cos.upload({
        bucket: code.bucket + '-' + userInfo.Response.AppId,
        file: inputs.src.path || inputs.src,
        key: code.object
      })
    }

    // 建立新的inputs
    inputs.code = code

    const apigwName = []
    if(inputs.events && inputs.events.length>0){
      for (let i = 0; i < inputs.events.length; i++) {
        const event = inputs.events[i]
        const eventType = Object.keys(event)[0]
        if(eventType=='apigw'){
          if(apigwName.includes(inputs.events[i][eventType].name)){
            throw new Error("APIGateway's name must be unique")
          }else{
            inputs.events[i][eventType].parameters.serviceName = inputs.events[i][eventType].name
            if(this.state && this.state.apigw && this.state.apigw.includes(inputs.events[i][eventType].name) && !inputs.events[i][eventType].parameters.serviceId){
              inputs.events[i][eventType].parameters.serviceId = this.state.apigwjson[inputs.events[i][eventType].name]
            }
            apigwName.push(inputs.events[i][eventType].name)
          }
        }
      }
    }


    const scf = new Scf(credentials, region)

    const scfOutput = await scf.deploy(inputs)

    this.state.function = scfOutput


    const output = {
      FunctionName: scfOutput.FunctionName,
      Description: scfOutput.Description,
      Region: scfOutput.Region,
      Namespace: scfOutput.Namespace,
      Runtime: scfOutput.Runtime,
      Handler: scfOutput.Handler,
      MemorySize: scfOutput.MemorySize,
    }

    // 处理APIGW和其他的event的输出
    let apigw = false
    if(inputs.events && inputs.events.length>0){
      output.Triggers = {}
      for (let i = 0; i < inputs.events.length; i++) {
        const event = inputs.events[i]
        const eventType = Object.keys(event)[0]
        if (!output.Triggers[eventType]) {
          output.Triggers[eventType] = []
        }
        if(eventType!='apigw'){
          output.Triggers[eventType].push(event[eventType].name)
        }else{
          apigw = true
        }
      }
    }

    if (scfOutput.Triggers && scfOutput.Triggers.length > 0 && apigw) {
      this.state.apigw = []
      this.state.apigwjson = {}
      for (let i = 0; i < scfOutput.Triggers.length; i++) {
        if (scfOutput.Triggers[i].serviceId) {
          this.state.apigw.push(scfOutput.Triggers[i].serviceName)
          this.state.apigwjson[scfOutput.Triggers[i].serviceName] = scfOutput.Triggers[i].serviceId
          for (let j = 0; j < scfOutput.Triggers[i].apiList.length; j++) {
            output.Triggers['apigw'].push(`${this.getDefaultProtocol(scfOutput.Triggers[i].protocols)}://${scfOutput.Triggers[i].subDomain}/${scfOutput.Triggers[i].environment}${scfOutput.Triggers[i].apiList[j].path}`)
          }
        }
      }
    }

    await this.save()

    return output

  }

  async remove(inputs = {}) {
    console.log(`Removing Tencent Serverless Cloud Funtion Tencent (SCF) ...`)
    const scf = new Scf(this.credentials.tencent, this.state.function.Region)
    await scf.remove(this.state.function)
    this.state = {}
    console.log(`Removed Tencent Serverless Cloud Funtion Tencent (SCF) ...`)
  }
}

module.exports = Express
