const LANGS = ['Nodejs', 'Python', 'Go', 'Php', 'Java']
const getLang = (runtime) => {
  for (let i = 0; i < LANGS.length; i++) {
    if (runtime.indexOf(LANGS[i]) === 0) {
      return LANGS[i]
    }
  }
  return 'Nodejs'
}
const CONFIGS = {
  templateUrl: 'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/scf-demo.zip',
  region: 'ap-guangzhou',
  runtime: 'Nodejs10.15',
  handler(runtime) {
    let handler = 'index.main_handler'
    const lang = getLang(runtime)
    switch (lang) {
      case 'Nodejs':
      case 'Php':
      case 'Python':
        handler = 'index.main_handler'
        break
      case 'Go':
        handler = 'main'
        break
      case 'Java':
        handler = 'example.Hello::mainHandler'
        break
      default:
        break
    }
    return handler
  },
  description(app) {
    return `This is a function in ${app} application`
  },
  triggerTypes: ['apigw', 'cos', 'timer', 'cmq', 'ckafka'],
  cos: {
    lifecycle: [
      {
        status: 'Enabled',
        id: 'deleteObject',
        filter: '',
        expiration: { days: '10' },
        abortIncompleteMultipartUpload: { daysAfterInitiation: '10' }
      }
    ]
  },
  defaultApigw: {
    type: 'apigw',
    protocols: ['http', 'https'],
    description: 'Created By Serverless Component',
    environment: 'release',
    apis: [
      {
        path: '/',
        method: 'GET'
      }
    ]
  }
}

module.exports = CONFIGS
