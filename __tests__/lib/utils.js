const { ServerlessSDK } = require('@serverless/platform-client-china')

const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, ms)
  })
}

function getServerlessSdk(orgName, orgUid) {
  const sdk = new ServerlessSDK({
    context: {
      orgUid,
      orgName
    }
  })
  return sdk
}

module.exports = { sleep, generateId, getServerlessSdk }
