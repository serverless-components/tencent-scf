const {Component} = require('@serverless/core')
const path = require('path')
const fs = require('fs')
const request = require('request')
const stringRandom = require('string-random')
const {Scf, Cos} = require('tencent-component-toolkit')

const templateDownloadUrl =
  'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/scf-demo.zip'

class Express extends Component {
  getDefaultProtocol(protocols) {
    if (String(protocols).includes('https')) {
      return 'https'
    }
    return 'http'
  }

  async downloadDefaultZip() {
    const scfUrl = templateDownloadUrl
    const loacalPath = '/tmp/' + stringRandom(10)
    fs.mkdirSync(loacalPath)
    return new Promise(function (resolve, reject) {
      request(scfUrl, function (error, response) {
        if (!error && response.statusCode == 200) {
          const stream = fs.createWriteStream(path.join(loacalPath, 'demo.zip'))
          request(scfUrl)
            .pipe(stream)
            .on('close', function () {
              resolve(path.join(loacalPath, 'demo.zip'))
            })
        } else {
          if (error) {
            reject(error)
          } else {
            reject(new Error('下载失败，返回状态码不是200，状态码：' + response.statusCode))
          }
        }
      })
    })
  }

  async deploy(inputs) {
    console.log(`Deploying Tencent Serverless Cloud Funtion Tencent (SCF) ...`)

    // 获取腾讯云密钥信息
    const credentials = {
      SecretId: this.credentials.tencent.tmpSecrets.TmpSecretId,
      SecretKey: this.credentials.tencent.tmpSecrets.TmpSecretKey,
      Token: this.credentials.tencent.tmpSecrets.Token
    }
    const appid = this.credentials.tencent.tmpSecrets.appId

    // 默认值
    const region = inputs.region || "ap-guangzhou"

    const code = {}

    const tempSrc = inputs.srcOriginal || inputs.src || {"no_src": true}

    code.bucket = tempSrc.bucket ? tempSrc.bucket : `sls-cloudfunction-${region}-code`
    code.object = tempSrc.object ? tempSrc.object : `/${inputs.name}-${Math.floor(Date.now() / 1000)}.zip`

    // 创建cos对象
    const cos = new Cos(credentials, region)
    // 创建存储桶 + 设置生命周期
    if (!tempSrc.bucket) {
      await cos.deploy({
        bucket: code.bucket + '-' + appid,
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

    console.log(inputs)

    // 上传代码
    let templateUrlOutput
    if(!tempSrc.object){
      // 需要上传
      if(tempSrc.no_src || typeof inputs.src != 'string'){
        // 使用默认模板
        templateUrlOutput = templateDownloadUrl
        inputs.srcOriginal = inputs.src
        const tempDir = await this.downloadDefaultZip()
        const sourceDirectory = await this.unzip(tempDir)
        const zipPath = await this.zip(path.join(sourceDirectory, './src'))
        inputs.src = zipPath
      }
      await cos.upload({
        bucket: code.bucket + '-' + appid,
        file: inputs.src,
        key: code.object
      })
    }

    // 建立新的inputs
    inputs.code = code

    console.log(inputs)

    const apigwName = []
    if (inputs.events && inputs.events.length > 0) {
      for (let i = 0; i < inputs.events.length; i++) {
        const event = inputs.events[i]
        const eventType = Object.keys(event)[0]
        if (eventType == 'apigw') {
          if (apigwName.includes(inputs.events[i][eventType].name)) {
            throw new Error("APIGateway's name must be unique")
          } else {
            inputs.events[i][eventType].parameters.serviceName = inputs.events[i][eventType].name
            if (this.state && this.state.apigw && this.state.apigw.includes(inputs.events[i][eventType].name) && !inputs.events[i][eventType].parameters.serviceId) {
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
    if (inputs.events && inputs.events.length > 0) {
      output.Triggers = {}
      for (let i = 0; i < inputs.events.length; i++) {
        const event = inputs.events[i]
        const eventType = Object.keys(event)[0]
        if (!output.Triggers[eventType]) {
          output.Triggers[eventType] = []
        }
        if (eventType != 'apigw') {
          output.Triggers[eventType].push(event[eventType].name)
        } else {
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

    this.state.region = region
    this.state.lambdaArn = scfOutput.FunctionName

    await this.save()

    if(templateUrlOutput){
      output.templateUrl = templateUrlOutput
    }

    return output

  }

  async remove(inputs = {}) {

    // 获取腾讯云密钥信息
    if (!this.credentials.tencent.tmpSecrets) {
      throw new Error('Please add SLS_QcsRole in your tencent account.')
    }
    const credentials = {
      SecretId: this.credentials.tencent.tmpSecrets.TmpSecretId,
      SecretKey: this.credentials.tencent.tmpSecrets.TmpSecretKey,
      Token: this.credentials.tencent.tmpSecrets.Token
    }

    console.log(`Removing Tencent Serverless Cloud Funtion Tencent (SCF) ...`)
    const scf = new Scf(credentials, this.state.function.Region)
    await scf.remove(this.state.function)
    this.state = {}
    console.log(`Removed Tencent Serverless Cloud Funtion Tencent (SCF)`)
  }
}

module.exports = Express
