# 配置文档

## 全部配置

```yml
# serverless.yml

component: scf # (必选) 组件名称，在该实例中为scf
name: scfdemo # 必选) 组件实例名称.
org: test # (可选) 用于记录组织信息，默认值为您的腾讯云账户 appid
app: scfApp # (可选) 用于记录组织信息. 默认与name相同.
stage: dev # (可选) 用于区分环境信息，默认值是 dev

inputs:
  name: myFunction # 云函数名称
  namespace: abc # 云函数命名空间
  role: exRole # 云函数执行角色
  enableRoleAuth:
    true # 默认会尝试创建 SCF_QcsRole 角色，如果不需要配置成 false 即可
    # 1. 默认写法，新建特定命名的 cos bucket 并上传
  src: ./code
  # 2. src 为对象，并且制定忽略上传文件夹 node_modules
  # src:
  #   src: ./code
  #   exclude:
  #     - 'node_modules/**'
  # 3. 指定 bucket name 和文件的方式，直接上传 cos 中的文件部署云函数
  # src:
  #    bucket: tinatest   # bucket name，当前会默认在bucket name后增加 appid 后缀, e.g. bucketname-appid
  #    key: 'code.zip'      # bucket key 指定存储桶内的文件
  # 4. 指定本地文件到 bucket
  # src:
  #   bucket: tinatest   # bucket name
  #   src:         # 指定本地路径
  handler: index.main_handler #入口
  runtime: Nodejs8.9 # 运行环境
  region: ap-guangzhou # 函数所在区域
  description: My Serverless Function
  memorySize: 128 # 内存大小，单位MB
  timeout: 20 # 超时时间，单位秒
  environment: #  环境变量
    variables: #  环境变量对象
      TEST: value
  vpcConfig: # 私有网络配置
    vpcId: '' # 私有网络的Id
    subnetId: '' # 子网ID
  deadLetter: # 死信队列配置
    type: deadLetterType
    name: deadLetterName
    filterType: deadLetterFilterType
  layers:
    - name: expressLayer #  layer名称
      version: 1 #  版本
  cls: # 函数日志
    logsetId: ClsLogsetId
    topicId: ClsTopicId
  eip: true/false # 是否开启固定IP
  tags:
    key1: value1
    key2: value2 # tags 的key value
  traffic: 0.9 # 配置默认流量中 $LATEST 版本比重：0 - 1
  events: # 触发器
    - timer: # 定时触发器
        name: timer
        parameters:
          cronExpression: '*/5 * * * *' # 每5秒触发一次
          enable: true
          argument: argument # 额外的参数
    - apigw: # api网关触发器
        name: serverless
        parameters:
          serviceId: service-8dsikiq6
          protocols:
            - http
          description: the serverless service
          environment: release
          endpoints:
            - path: /users
              method: POST
            - path: /test/{abc}/{cde}
              apiId: api-id
              method: GET
              description: Serverless REST API
              enableCORS: TRUE
              responseType: HTML
              serviceTimeout: 10
              param:
                - name: abc
                  position: PATH
                  required: 'TRUE'
                  type: string
                  defaultValue: abc
                  desc: mytest
                - name: cde
                  position: PATH
                  required: 'TRUE'
                  type: string
                  defaultValue: abc
                  desc: mytest
              function:
                isIntegratedResponse: TRUE
                functionQualifier: $LATEST #  当配置 traffic 时，需要配置为 $DEFAUlt
              usagePlan:
                usagePlanId: 1111
                usagePlanName: slscmp
                usagePlanDesc: sls create
                maxRequestNum: 1000
              auth:
                serviceTimeout: 15
                secretName: secret
                secretIds:
                  - xxx
    - apigw:
        name: serverless_test
        parameters:
          serviceId: service-cyjmc4eg
          protocols:
            - http
          description: the serverless service
          environment: release
          endpoints:
            - path: /users
              method: POST
    - cos: # cos触发器
        name: cli-appid.cos.ap-beijing.myqcloud.com
        parameters:
          bucket: cli-appid.cos.ap-beijing.myqcloud.com
          filter:
            prefix: filterdir/
            suffix: .jpg
          events: 'cos:ObjectCreated:*'
          enable: true
    - cmq: # CMQ Topic 触发器
        name: cmq_trigger
        parameters:
          name: test-topic-queue
          enable: true
    - ckafka: # ckafka触发器
        name: ckafka_trigger
        parameters:
          name: ckafka-2o10hua5
          topic: test
          maxMsgNum: 999
          offset: latest
          enable: true
```

## 配置描述

主要的参数

| 参数名称                 | 是否必选 | 默认值       | 描述                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name                     | 是       |              | 创建的函数名称，函数名称支持 26 个英文字母大小写、数字、连接符和下划线，第一个字符只能以字母开头，最后一个字符不能为连接符或者下划线，名称长度 2-60                                                                                                                                                                                       |
| namesapce                | 否       | default      | 命名空间。默认为 default。                                                                                                                                                                                                                                                                                                                |
| role                     | 否       |              | 函数绑定的角色                                                                                                                                                                                                                                                                                                                            |
| enableRoleAuth           | 是       | true         | 默认会尝试创建 SCF_QcsRole 角色。SCF_QcsRole 为 SCF 默认配置角色。该服务角色用于提供 SCF 配置对接其他云上资源的权限，包括但不限于代码文件访问、触发器配置。配置角色的预设策略可支持函数执行的基本操作。如果不需要配置成 false 即可。[相关文档](https://cloud.tencent.com/document/product/583/32389#.E8.A7.92.E8.89.B2.E8.AF.A6.E6.83.85) |
| src                      | 是       |              | 函数代码路径。如果是对象,配置参数参考 [执行目录](#执行目录)                                                                                                                                                                                                                                                                               |
| handler                  | 是       |              | 函数处理方法名称，名称格式支持 "文件名称.方法名称" 形式，文件名称和函数名称之间以"."隔开，文件名称和函数名称要求以字母开始和结尾，中间允许插入字母、数字、下划线和连接符，文件名称和函数名字的长度要求是 2-60 个字符                                                                                                                      |
| runtime                  | 是       |              | 函数运行环境，目前仅支持 Python2.7，Python3.6，Nodejs6.10，Nodejs8.9，Nodejs10.15，Nodejs12.16， PHP5， PHP7，Go1 和 Java8，默认 Python2.7                                                                                                                                                                                                |
| region                   | 否       | ap-guangzhou | 云函数所在区域。详见产品支持的 [地域列表](https://cloud.tencent.com/document/api/583/17238#.E5.9C.B0.E5.9F.9F.E5.88.97.E8.A1.A8)。                                                                                                                                                                                                        |
| description              | 否       |              | 函数描述,最大支持 1000 个英文字母、数字、空格、逗号、换行符和英文句号，支持中文                                                                                                                                                                                                                                                           |
| memorySize               | 否       | 128M         | 函数运行时内存大小，默认为 128M，可选范围 64、128MB-3072MB，并且以 128MB 为阶梯                                                                                                                                                                                                                                                           |
| timeout                  | 否       | 3S           | 函数最长执行时间，单位为秒，可选值范围 1-900 秒，默认为 3 秒                                                                                                                                                                                                                                                                              |
| [environment](#环境变量) | 否       |              | 函数的环境变量                                                                                                                                                                                                                                                                                                                            |
| [vpcConfig](#私有网络)   | 否       |              | 函数的私有网络配置，配置参数参考[私有网络]()                                                                                                                                                                                                                                                                                              |
| layers                   | 否       |              | 云函数绑定的 layer, 配置参数参考[层配置](#层配置)                                                                                                                                                                                                                                                                                         |
| deadLetter               | 否       |              | 死信队列参数                                                                                                                                                                                                                                                                                                                              |
| cls                      | 否       |              | 函数日志                                                                                                                                                                                                                                                                                                                                  |
| eip                      | 否       | false        | 固定出口 IP。默认为 false，即不启用                                                                                                                                                                                                                                                                                                       |
| tags                     | 否       |              | 标签设置。可设置多对 key-value 的键值对                                                                                                                                                                                                                                                                                                   |
| events                   | 否       |              | 触发器数组。支持以下几种触发器：timer（定时触发器）、apigw（网关触发器）、cos（COS 触发器）、cmq（CMQ Topic 触发器）、ckafka（CKafka 触发器）配置参数参考触发器。                                                                                                                                                                         |
| traffic                  | 否       | 1            | 配置默认流量中 `$LATEST` 版本比重，取值范围：0 ~ 1，比如 80%，可配置成 0.8。注意如果皮遏制灰度流量，需要配置对应的 API 网关触发器的 endpoints 的 `function.functionQualifier` 参数为 `$DEFAULT` (默认流量)                                                                                                                                |

### 执行目录

| 参数名称 | 是否必选 |      类型       | 默认值 | 描述                                                                                                                                                                                 |
| -------- | :------: | :-------------: | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src      |    否    |     String      |        | 代码路径。与 object 不能同时存在。                                                                                                                                                   |
| exclude  |    否    | Array of String |        | 不包含的文件或路径, 遵守 [glob 语法](https://github.com/isaacs/node-glob)                                                                                                            |
| bucket   |    否    |     String      |        | bucket 名称。如果配置了 src，表示部署 src 的代码并压缩成 zip 后上传到 bucket-appid 对应的存储桶中；如果配置了 object，表示获取 bucket-appid 对应存储桶中 object 对应的代码进行部署。 |
| object   |    否    |     String      |        | 部署的代码在存储桶中的路径。                                                                                                                                                         |

### 环境变量

| 参数名称  | 类型                                                                           | 描述                                      |
| --------- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| variables | Array of [Variable](https://cloud.tencent.com/document/api/583/17244#Variable) | 环境变量参数，包含多对 key-value 的键值对 |

### 私有网络

| 参数名称 | 类型   | 描述           |
| -------- | ------ | -------------- |
| subnetId | String | 私有网络 的 Id |
| vpcId    | String | 子网的 Id      |

### 死信队列

| 名称       | 是否必选 | 类型   | 描述                       |
| :--------- | -------- | :----- | :------------------------- |
| Type       | 是       | String | 死信队列模式               |
| Name       | 是       | String | 死信队列名称               |
| FilterType | 否       | String | 死信队列主题模式的标签形式 |

### 层配置

| 参数名称 | 是否必选 |  类型  | 默认值 | 描述     |
| -------- | :------: | :----: | :----: | :------- |
| name     |    否    | String |        | 层名称   |
| version  |    否    | String |        | 层版本号 |

### 函数日志

| 参数名称 | 是否必选 |  类型  | 默认值 | 描述                          |
| -------- | :------: | :----: | :----: | :---------------------------- |
| logsetId |    否    | String |        | 函数日志投递到的 CLS LogsetID |
| topicId  |    否    | String |        | 函数日志投递到的 CLS TopicID  |

### 触发器

参考： https://cloud.tencent.com/document/product/583/39901

触发器为数组。支持以下触发器：timer（定时触发器）、apigw（网关触发器）、cos（COS 触发器）、cmq（CMQ Topic 触发器）、ckafka（CKafka 触发器）。

| 参数名称 | 是否必选 |  类型  | 默认值 | 描述                                                        |
| -------- | :------: | :----: | :----: | :---------------------------------------------------------- |
| name     |    是    | String |        | 触发器名称(如果是 apigw，则该参数也是 apigw 的 serviceName) |
| param    |    是    | Object |        | 根据触发器类型，参考以下触发器参数表                        |

##### timer 触发器参数

参考： https://cloud.tencent.com/document/product/583/9708

| 参数名称       | 是否必选 |  类型   | 默认值 | 描述                                                                                                            |
| -------------- | :------: | :-----: | :----: | :-------------------------------------------------------------------------------------------------------------- |
| cronExpression |    是    | Number  |   3    | 触发时间，为[crons](https://cloud.tencent.com/document/product/583/9708#cron-.E8.A1.A8.E8.BE.BE.E5.BC.8F)表达式 |
| enable         |    否    | Boolean |  true  | 触发器是否启用。默认启用                                                                                        |
| argument       |    否    | Object  |        | 入参参数。                                                                                                      |

##### cos 触发器参数

参考： https://cloud.tencent.com/document/product/583/9707

| 参数名称 | 是否必选 |                                    类型                                     | 默认值 | 描述                                                                                                                    |
| -------- | :------: | :-------------------------------------------------------------------------: | :----: | :---------------------------------------------------------------------------------------------------------------------- |
| bucket   |    是    |                                   String                                    |        | 配置的 COS Bucket，仅支持选择同地域下的 COS 存储桶                                                                      |
| enable   |    否    |                                   Boolean                                   |  true  | 触发器是否启用。默认启用                                                                                                |
| filter   |    是    | [CosFilter](https://cloud.tencent.com/document/product/583/39901#CosFilter) |        | COS 文件名的过滤规则                                                                                                    |
| events   |    是    |                                   String                                    |        | [COS 的事件类型](https://cloud.tencent.com/document/product/583/9707#cos-.E8.A7.A6.E5.8F.91.E5.99.A8.E5.B1.9E.E6.80.A7) |

##### cmq 触发器参数

| 参数名称 | 是否必选 | 类型    | 默认值 | 描述                     |
| -------- | -------- | ------- | ------ | :----------------------- |
| name     | 是       | String  |        | CMQ Topic 主题队列名称   |
| enable   | 否       | Boolean | true   | 触发器是否启用。默认启用 |

##### ckafka 触发器参数

| 参数名称  | 是否必选 | 类型    | 默认值 | 描述                                                       |
| --------- | -------- | ------- | ------ | :--------------------------------------------------------- |
| name      | 是       | String  |        | 配置连接的 CKafka 实例，仅支持选择同地域下的实例。         |
| topic     | 是       | String  |        | 支持在 CKafka 实例中已经创建的 Topic。                     |
| maxMsgNum | 是       | Int     |        | 5 秒内每汇聚 maxMsgNum 条 Ckafka 消息，则触发一次函数调用  |
| offset    | 是       | String  |        | offset 为开始消费 Ckafka 消息的位置，目前只能填写 `latest` |
| enable    | 否       | Boolean | true   | 触发器是否启用。默认启用                                   |

##### apigw 触发器参数

| 参数名称    | 是否必选 |   类型   | 默认值   | 描述                                                                  |
| ----------- | -------- | :------: | :------- | :-------------------------------------------------------------------- |
| serviceId   | 否       |  String  |          | Apigw Service ID（不传入则新建一个 Service）                          |
| protocols   | 否       | String[] | ['http'] | 前端请求的类型，如 http，https，http 与 https                         |
| serviceName | 否       |  String  |          | Apigw API 名称。如果不传递则默认自动新建一个。                        |
| description | 否       |  String  |          | Apigw API 描述                                                        |
| environment | 是       |  String  | release  | 发布的环境，填写 `release`、`test` 或 `prepub`，不填写默认为`release` |
| endpoints   | 是       | Object[] |          | 参考 endpoint 参数。                                                  |

##### endpoints 参数

参考： https://cloud.tencent.com/document/product/628/14886

| 参数名称       | 是否必选 |  类型   | 默认值 | 描述                                                                                                      |
| -------------- | -------- | :-----: | :----- | :-------------------------------------------------------------------------------------------------------- |
| path           | 是       | String  |        | API 的前端路径，如/path。                                                                                 |
| method         | 否       | String  |        | API 的前端请求方法，如 GET                                                                                |
| apiId          | 否       | String  |        | API ID。如果不传递则根据 path 和 method 创建一个，传递了直接忽略 path 和 method 参数。                    |
| description    | 否       | String  |        | API 描述                                                                                                  |
| enableCORS     | 是       | Boolean | FALSE  | 是否需要开启跨域，TRUE 表示需要，FALSE 表示不需要。默认为 FALSE。                                         |
| responseType   | 否       | String  |        | 自定义响应配置返回类型，现在只支持 HTML、JSON、TEST、BINARY、XML（此配置仅用于生成 API 文档提示调用者）。 |
| serviceTimeout | 是       |   Int   |        | API 的后端服务超时时间，单位是秒。                                                                        |
| param          | 否       |         |        | 前端参数                                                                                                  |
| function       | 否       |         |        | SCF 配置                                                                                                  |
| usagePlan      | 否       |         |        | 使用计划                                                                                                  |
| auth           | 否       |         |        | API 密钥配置                                                                                              |

- 前端参数

| 参数名称     | 是否必选 | 类型   | 默认值 | 描述                                                      |
| ------------ | -------- | ------ | ------ | --------------------------------------------------------- |
| name         | 否       | String |        | API 的前端参数名称。                                      |
| position     | 否       | String |        | API 的前端参数位置。当前仅支持 PATH、QUERY、HEADER        |
| required     | 否       | String |        | API 的前端参数是否必填，TRUE：表示必填，FALSE：表示可选。 |
| type         | 否       | String |        | API 的前端参数类型，如 String、Int 等。                   |
| defaultValue | 否       | String |        | API 的前端参数默认值。                                    |
| desc         | 否       | String |        | API 的前端参数备注。                                      |

- SCF 配置

| 参数名称             | 是否必选 | 类型    | 默认值 | 描述                                                   |
| -------------------- | -------- | ------- | ------ | ------------------------------------------------------ |
| isIntegratedResponse | 否       | Boolean | FALSE  | 是否启用 SCF 集成响应，TRUE 表示开启，FALSE 表示关闭。 |
| functionQualifier    | 否       | String  |        | SCF 版本号，默认为 \$LATEST。                          |

- 使用计划

参考: https://cloud.tencent.com/document/product/628/14947

| 参数名称      | 是否必选 | 类型   | 描述                                                    |
| ------------- | :------: | ------ | :------------------------------------------------------ |
| usagePlanId   |    否    | String | 用户自定义使用计划 ID                                   |
| usagePlanName |    否    | String | 用户自定义的使用计划名称                                |
| usagePlanDesc |    否    | String | 用户自定义的使用计划描述                                |
| maxRequestNum |    否    | Int    | 请求配额总数，如果为空，将使用-1 作为默认值，表示不开启 |

- API 密钥配置

参考: https://cloud.tencent.com/document/product/628/14916

| 参数名称   | 类型   | 描述     |
| ---------- | :----- | :------- |
| secretName | String | 密钥名称 |
| secretIds  | String | 密钥 ID  |
