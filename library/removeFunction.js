const tencentcloud = require('tencentcloud-sdk-nodejs')
const Abstract = require('./abstract')
const models = tencentcloud.scf.v20180416.Models
const util = require('util')

class RemoveFunction extends Abstract {
  constructor(appid, secret_id, secret_key, options) {
    super(appid, secret_id, secret_key, options)
  }

  async remove(funcName) {
    const delFuncRequest = new models.DeleteFunctionRequest()
    delFuncRequest.FunctionName = funcName

    const handler = util.promisify(this.scfClient.DeleteFunction.bind(this.scfClient))
    try {
      this.logger('Removing function', funcName)
      const result = await handler(delFuncRequest)
      this.logger('Request id', result.RequestId)
    } catch (e) {
      throw e
    }
  }
}

module.exports = RemoveFunction
