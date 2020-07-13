const CONFIGS = {
  templateUrl:
    'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/scf-demo-test.zip',
  region: 'ap-guangzhou',
  compName: 'scf',
  componentFullname: 'SCF',
  runtime: 'Nodejs10.15',
  handler: 'index.main_handler',
  description: 'Created by Serverless Component',
  defaultApigw: {
    name: `serverless_api`,
    parameters: {
      protocols: ['http', 'https'],
      description: 'Created By Serverless Component',
      environment: 'release',
      endpoints: [
        {
          path: '/',
          method: 'GET'
        }
      ]
    }
  }
}

module.exports = CONFIGS
