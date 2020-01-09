const tencentcloud = require('tencentcloud-sdk-nodejs')
const ClientProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/client_profile.js')
const HttpProfile = require('tencentcloud-sdk-nodejs/tencentcloud/common/profile/http_profile.js')
const assert = require('assert')
const COS = require('cos-nodejs-sdk-v5')
const { Credential } = tencentcloud.common
const ScfClient = tencentcloud.scf.v20180416.Client
const CamClient = tencentcloud.cam.v20190116.Client
const TagClient = tencentcloud.tag.v20180813.Client

class AbstractHandler {
  constructor({ appid, secret_id, secret_key, options, context }) {
    this.appid = appid
    this.options = options
    this.context = context
    assert(options, 'Options should not is empty')
    this._scfClient = AbstractHandler.createScfClient(secret_id, secret_key, options)
    this._tagClient = AbstractHandler.createTagClient(secret_id, secret_key, options)
    this._cosClient = AbstractHandler.createCosClient(secret_id, secret_key, options)
    this._camClient = AbstractHandler.createCamClient(secret_id, secret_key, options)
  }

  static getClientInfo(secret_id, secret_key, options) {
    const cred = options.token
      ? new Credential(secret_id, secret_key, options.token)
      : new Credential(secret_id, secret_key)
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

  static createCamClient(secret_id, secret_key, options) {
    const info = this.getClientInfo(secret_id, secret_key, options)
    const camCli = new CamClient(info.cred, info.region, info.clientProfile)
    camCli.sdkVersion = 'ServerlessComponent'
    return camCli
  }

  static createTagClient(secret_id, secret_key, options) {
    const info = this.getClientInfo(secret_id, secret_key, options)
    const tagCli = new TagClient(info.cred, info.region, info.clientProfile)
    tagCli.sdkVersion = 'ServerlessComponent'
    return tagCli
  }

  static createCosClient(secret_id, secret_key, options) {
    const fileParallelLimit = options.fileParallelLimit || 5
    const chunkParallelLimit = options.chunkParallelLimit || 8
    const chunkSize = options.chunkSize || 1024 * 1024 * 8
    const timeout = options.timeout || 60

    if (!options.token) {
      return new COS({
        SecretId: secret_id,
        SecretKey: secret_key,
        FileParallelLimit: fileParallelLimit,
        ChunkParallelLimit: chunkParallelLimit,
        ChunkSize: chunkSize,
        Timeout: timeout * 1000
      })
    }

    return new COS({
      getAuthorization: function(option, callback) {
        callback({
          TmpSecretId: secret_id,
          TmpSecretKey: secret_key,
          XCosSecurityToken: options.token,
          ExpiredTime: options.timestamp
        })
      }
    })
  }

  get cosClient() {
    return this._cosClient
  }

  get scfClient() {
    return this._scfClient
  }

  get camClient() {
    return this._camClient
  }

  get tagClient() {
    return this._tagClient
  }
}

module.exports = AbstractHandler
