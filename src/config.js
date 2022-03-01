const LANGS = ['Nodejs', 'Python', 'Go', 'Php', 'Java']
const getLang = (runtime) => {
  for (let i = 0; i < LANGS.length; i++) {
    if (runtime.indexOf(LANGS[i]) === 0) {
      return LANGS[i]
    }
  }
  return 'Nodejs'
}

const WEB_FUNC_CONFIGS = {
  'Python2.7': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-python2-demo.zip',
    entryFile: 'app.py',
    bootstrapRunner: '/var/lang/python2/bin/python2 -u'
  },
  'Python3.6': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-python3-demo.zip',
    entryFile: 'app.py',
    bootstrapRunner: '/var/lang/python3/bin/python3 -u'
  },
  'Python3.7': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-python37-demo.zip',
    entryFile: 'app.py',
    bootstrapRunner: '/var/lang/python37/bin/python3 -u'
  },
  'Nodejs10.15': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-node10-demo.zip',
    entryFile: 'app.js',
    bootstrapRunner: '/var/lang/node10/bin/node'
  },
  'Nodejs12.16': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-node12-demo.zip',
    entryFile: 'app.js',
    bootstrapRunner: '/var/lang/node12/bin/node'
  },
  'Nodejs14.18': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-node14-demo.zip',
    entryFile: 'app.js',
    bootstrapRunner: '/var/lang/node14/bin/node'
  },
  'Nodejs16.13': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-node16-demo.zip',
    entryFile: 'app.js',
    bootstrapRunner: '/var/lang/node16/bin/node'
  },
  Php5: {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-php5-demo.zip',
    entryFile: 'hello.php',
    bootstrapRunner: '/var/lang/php5/bin/php -S 0.0.0.0:9000'
  },
  Php7: {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-php7-demo.zip',
    entryFile: 'hello.php',
    bootstrapRunner: '/var/lang/php7/bin/php -S 0.0.0.0:9000'
  },
  'Php7.4': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-php74-demo.zip',
    entryFile: 'hello.php',
    bootstrapRunner: '/var/lang/php74/bin/php -S 0.0.0.0:9000'
  },
  'Php8.0': {
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/webfunc-php80-demo.zip',
    entryFile: 'hello.php',
    bootstrapRunner: '/var/lang/php80/bin/php -S 0.0.0.0:9000'
  }
}

const CONFIGS = {
  templateUrl: 'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/scf-demo.zip',
  region: 'ap-guangzhou',
  compName: 'scf',
  compFullname: 'SCF',
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
  triggerTypes: ['apigw', 'cos', 'timer', 'cmq', 'ckafka', 'cls', 'mps', 'clb'],
  defaultApigw: {
    parameters: {
      protocols: ['http', 'https'],
      description: 'Created By Serverless Component',
      environment: 'release',
      endpoints: [
        {
          path: '/',
          method: 'ANY'
        }
      ]
    }
  },
  defaultwebFunc: WEB_FUNC_CONFIGS
}

module.exports = CONFIGS
