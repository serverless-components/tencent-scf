const tencentcloud = require('tencentcloud-sdk-nodejs')
const ClientProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/client_profile.js')
const HttpProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/http_profile.js')
const assert = require('assert')
const COS = require('cos-nodejs-sdk-v5')

const { Credential } = tencentcloud.common
const ScfClient = tencentcloud.scf.v20180416.Client

class AbstractHandler {
  constructor(appid, secret_id, secret_key, options) {
    this.appid = appid
    this.secret_id = secret_id
    this.secret_key = secret_key
    this.options = options

    assert(options, 'Options should not is empty')
    this._scfClient = AbstractHandler.createScfClient(secret_id, secret_key, options)
    this._cosClient = AbstractHandler.createCosClient(secret_id, secret_key, options)
  }

  static getClientInfo(secret_id, secret_key, options) {
    const cred = new Credential(secret_id, secret_key)
    const httpProfile = new HttpProfile()
    httpProfile.reqTimeout = 30
    const clientProfile = new ClientProfile('HmacSHA256', httpProfile)
    assert(options.region, 'Region should not is empty')
    return {
      cred: cred,
      region: options.region,
      clientProfile: clientProfile
    }
  }

  static createScfClient(secret_id, secret_key, options) {
    const info = this.getClientInfo(secret_id, secret_key, options)
    const scfCli = new ScfClient(info.cred, info.region, info.clientProfile)
    scfCli.sdkVersion = 'ServerlessComponent'
    return scfCli
  }

  static createCosClient(secret_id, secret_key, options) {
    const fileParallelLimit = options.fileParallelLimit || 5
    const chunkParallelLimit = options.chunkParallelLimit || 8
    const chunkSize = options.chunkSize || 1024 * 1024 * 8
    const timeout = options.timeout || 60

    return new COS({
      SecretId: secret_id,
      SecretKey: secret_key,
      FileParallelLimit: fileParallelLimit,
      ChunkParallelLimit: chunkParallelLimit,
      ChunkSize: chunkSize,
      Timeout: timeout * 1000
    })
  }

  logger() {
    if (process.env['SLS_SCF_DEBUG']) {
      this.output(...arguments)
    }
  }

  get cosClient() {
    return this._cosClient
  }

  get scfClient() {
    return this._scfClient
  }
}

module.exports = AbstractHandler
