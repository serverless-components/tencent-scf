# 配置文档

## 全部配置

```yml
# serverless.yml

#应用组织信息
org: '' # 组织名称。留空则则使用默认值为用户appid
app: '' # 应用名称。留空则默认取当前组件的实例名称为app名称。
stage: '' # 环境名称。默认值是 dev。建议使用${env.STAGE}变量定义环境名称

#组件信息
component: scf # (必选) 组件名称，在该实例中为scf
name: scfdemo # (必选) 组件实例名称。

#组件参数配置
inputs:
  name: ${name}-${stage}-${app} # 云函数名称，默认为 ${name}-${stage}-${app}
  namespace: default
  role: exRole # 云函数执行角色
  enableRoleAuth: true # 默认会尝试创建 SCF_QcsRole 角色，如果不需要配置成 false 即可
  # 1. 默认写法，新建特定命名的 cos bucket 并上传
  src: ./src
  # 2. src 为对象，并且制定忽略上传文件夹 node_modules
  # src:
  #   src: ./code
  #   exclude:
  #     - 'node_modules/**'
  # 3. 指定 bucket name 和文件的方式，直接上传 cos 中的文件部署云函数
  # src:
  #    bucket: tinatest   # bucket name 存储桶名称
  #    key: 'code.zip'      # bucket key 指定存储桶内的文件
  # 4. 指定本地文件到 bucket
  # src:
  #   bucket: tinatest   # bucket name
  #   src:         # 指定本地路径
  handler: index.main_handler #入口
  runtime: Nodejs10.15 # 运行环境 默认 Nodejs10.15
  region: ap-guangzhou # 函数所在区域
  description: This is a function in ${app} application.
  memorySize: 128 # 内存大小，单位MB
  timeout: 20 # 函数执行超时时间，单位秒
  initTimeout: 3 # 初始化超时时间，单位秒
  environment: #  环境变量
    variables: #  环境变量对象
      TEST: value
  publicAccess: true # 是否开启公网访问
  vpcConfig: # 私有网络配置
    vpcId: vpc-xxx # 私有网络的Id
    subnetId: subnet-xxx # 子网ID
  cfs: # cfs配置
    - cfsId: cfs-123
      mountInsId: cfs-123
      localMountDir: /mnt/
      remoteMountDir: /
  deadLetter: # 死信队列配置
    type: deadLetterType
    name: deadLetterName
    filterType: deadLetterFilterType
  layers: #layer配置
    - name: scfLayer #  layer名称
      version: 1 #  版本
  cls: # 函数日志
    logsetId: ClsLogsetId
    topicId: ClsTopicId
  eip: false # 是否开启固定IP
  asyncRunEnable: false # 是否支持长时间运行
  tags: #标签配置
    key1: value1
    key2: value2 # tags 的key value
  events: # 触发器
    - timer: # 定时触发器
        parameters:
          # name: timer # 触发器名称，默认timer-${name}-${stage}
          qualifier: $DEFAULT # 别名配置
          cronExpression: '*/5 * * * * * *' # 每5秒触发一次
          enable: true
          argument: argument # 额外的参数
    - apigw: # api网关触发器，已有apigw服务，配置触发器
        parameters:
          serviceName: serverless
          serviceId: service-8dsikiq6
          protocols:
            - http
          netTypes:
            - OUTER
          description: the serverless service
          environment: release
          endpoints:
            - path: /users
              method: POST
            - path: /test/{abc}/{cde}
              apiId: api-id
              apiName: index
              method: GET
              description: Serverless REST API
              enableCORS: true
              responseType: HTML
              serviceTimeout: 10
              isBase64Encoded: false
              isBase64Trigger: false
              base64EncodedTriggerRules:
                - name: Accept
                  value:
                    - image/jpeg
                - name: Content_Type
                  value:
                    - image/jpeg
              param:
                - name: abc
                  position: PATH
                  required: true
                  type: string
                  defaultValue: abc
                  desc: mytest
                - name: cde
                  position: PATH
                  required: true
                  type: string
                  defaultValue: abc
                  desc: mytest
              function:
                isIntegratedResponse: true
                functionQualifier: $DEFAULT
              usagePlan:
                usagePlanId: 1111
                usagePlanName: slscmp
                usagePlanDesc: sls create
                maxRequestNum: 1000
              auth:
                secretName: secret
                secretIds:
                  - xxx
    - apigw: # api网关触发器，无apigw服务，自动创建服务
        parameters:
          serviceName: apigw-xxxx
          protocols:
            - http
          description: the serverless service
          environment: release
          endpoints:
            - path: /users
              method: POST
    - cos: # cos触发器
        parameters:
          qualifier: $DEFAULT # 别名配置
          bucket: cli-appid.cos.ap-beijing.myqcloud.com
          filter:
            prefix: filterdir/
            suffix: .jpg
          events: 'cos:ObjectCreated:*'
          enable: true
    - cmq: # CMQ Topic 触发器
        parameters:
          qualifier: $DEFAULT # 别名配置
          name: test-topic-queue
          enable: true
          filterType: 1 # 消息过滤类型，1为标签类型，2为路由匹配类型
          filterKey: # 当 filterType 为1时表示消息过滤标签，当 filterType 为2时表示 Binding Key
            - key1
            - key2
    - ckafka: # ckafka触发器
        parameters:
          qualifier: $DEFAULT # 别名配置
          name: ckafka-2o10hua5
          topic: test
          maxMsgNum: 999
          offset: latest
          enable: true
          retry: 10000
    - cls: # cls 触发器
        parameters:
          qualifier: '$DEFAULT' # 别名配置
          topicId: '31d3ce01-228b-42f5-aab5-7f740cc2fb11' # 日志主题 ID
          maxWait: 60 # 最长等待时间，单位秒
          enable: true
    - mps: # mps 触发器
        parameters:
          qualifier: '$DEFAULT' # 别名配置
          type: EditMediaTask # 事件类型
          enable: true
```

## 配置描述

主要的参数

参考： https://cloud.tencent.com/document/product/583/18586

| 参数名称                 | 必选 | 默认值                                                                                                         | 描述                                                                                                                                                                                                                                                               |
| ------------------------ | ---- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| name                     | 是   | `${name}-${stage}-${app}`                                                                                      | 创建的函数名称。函数名称支持 26 个英文字母大小写、数字、连接符和下划线，第一个字符只能以字母开头，最后一个字符不能为连接符或者下划线，名称长度 2-60。**云函数名称又是资源 ID，为了保证资源的唯一性，默认采用 `${name}-${stage}-${app}` 变量方式。**                |
| namespace                | 否   | `default`                                                                                                      | 函数命名空间。云函数旧版本会以命名空间作为环境隔离，SCF 组件保留此参数，但不推荐使用此方式进行隔离。                                                                                                                                                               |
| role                     | 否   |                                                                                                                | 云函数绑定的运行角色。                                                                                                                                                                                                                                             |
| enableRoleAuth           | 否   | `true`                                                                                                         | 默认会尝试创建 `SCF_QcsRole` 角色。`SCF_QcsRole` 为 SCF 默认配置角色。该服务角色用于提供 SCF 配置对接其他云上资源的权限，包括但不限于代码文件访问、触发器配置。配置角色的预设策略可支持函数执行的基本操作。如果不需要配置成 false 即可。[相关文档][函数角色与授权] |
| src                      | 是   |                                                                                                                | 函数代码路径。如果是对象,配置参数参考 [执行目录](#执行目录)                                                                                                                                                                                                        |
| handler                  | 否   | Pyton/Php/Nodejs 默认值为 `index.main_handler`，Java 默认值为 `example.Hello::mainHandler`，Go 默认值为 `main` | 函数处理方法名称，名称格式支持 "文件名称.方法名称" 形式，文件名称和函数名称之间以"."隔开，文件名称和函数名称要求以字母开始和结尾，中间允许插入字母、数字、下划线和连接符，文件名称和函数名字的长度要求是 2-60 个字符。                                             |
| runtime                  | 否   | `Nodejs10.15`                                                                                                  | 函数运行环境，目前仅支持: `Nodejs6.10，Nodejs8.9，Nodejs10.15，Nodejs12.16，Python2.7，Python3.6，PHP5，PHP7，Go1，Java8 和 CustomRuntime`，使用 `CustomRuntime` 部署参考 [CustomRuntime][customruntime]                                                           |
| region                   | 否   | `ap-guangzhou`                                                                                                 | 云函数所在区域。详见产品支持的 [地域列表][函数地域列表]。                                                                                                                                                                                                          |
| description              | 否   | `This is a function in ${app} application`                                                                     | 函数描述,最大支持 1000 个英文字母、数字、空格、逗号、换行符和英文句号，支持中文                                                                                                                                                                                    |
| memorySize               | 否   | `128`                                                                                                          | 函数运行时内存大小，默认为 128M，可选范围 64、128MB-3072MB，并且以 128MB 为阶梯                                                                                                                                                                                    |
| timeout                  | 否   | `3`                                                                                                            | 函数最长执行时间，单位为秒，可选值范围 1-900 秒，默认为 3 秒                                                                                                                                                                                                       |
| initTimeout              | 否   | `3`                                                                                                            | 函数初始化超时时间，单位为秒，可选值范围 1-30 秒 秒                                                                                                                                                                                                                |
| eip                      | 否   | `false`                                                                                                        | 是否[固定出口 IP][固定出口ip]                                                                                                                                                                                                                                      |
| publicAccess             | 否   | `true`                                                                                                         | 是否开启公网访问                                                                                                                                                                                                                                                   |
| [environment](#环境变量) | 否   |                                                                                                                | 函数的环境变量，配置参考[环境变量](#环境变量)                                                                                                                                                                                                                      |
| [vpcConfig](#私有网络)   | 否   |                                                                                                                | 函数的私有网络配置，配置参数参考[私有网络](#私有网络)                                                                                                                                                                                                              |
| [layers](#层配置)        | 否   |                                                                                                                | 云函数绑定的 layer, 配置参数参考[层配置](#层配置)                                                                                                                                                                                                                  |
| [deadLetter](#死信队列)  | 否   |                                                                                                                | 死信队列配置，配置参数参考[死信队列](#死信队列)                                                                                                                                                                                                                    |
| [cls](#函数日志)         | 否   |                                                                                                                | 函数日志配置，配置参数参考[函数日志](#函数日志)                                                                                                                                                                                                                    |
| eip                      | 否   | `false`                                                                                                        | 固定出口 IP。默认为 false，即不启用。                                                                                                                                                                                                                              |
| asyncRunEnable           | 否   | `false`                                                                                                        | 是否开启长时间运行，默认最大支持 `12小时`，如果配置为 `true`，`cls`（函数日志配置） 必须，                                                                                                                                                                         |
| tags                     | 否   |                                                                                                                | 标签设置。可设置多对 key-value 的键值对                                                                                                                                                                                                                            |
| [cfs](#文件系统)         | 否   |                                                                                                                | 文件系统挂载配置，用于云函数挂载文件系统。配置参数参考[文件系统](#文件系统)。                                                                                                                                                                                      |
| [events](#触发器)        | 否   |                                                                                                                | 触发器数组。支持以下几种触发器：timer（定时触发器）、apigw（网关触发器）、cos（COS 触发器）、cmq（CMQ Topic 触发器）、ckafka（CKafka 触发器）配置参数参考[触发器](#触发器)。                                                                                       |

### 执行目录

| 参数名称 | 必选 |      类型       | 默认值 | 描述                                                                                                                                                  |
| -------- | :--: | :-------------: | :----: | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| src      |  是  |     string      |        | 代码路径。与 object 不能同时存在。                                                                                                                    |
| exclude  |  否  | Array of string |        | 不包含的文件或路径, 遵守 [glob 语法][glob语法参考]                                                                                                    |
| bucket   |  否  |     string      |        | 存储桶名称。如果配置了 src，表示部署 src 的代码并压缩成 zip 后上传到对应的存储桶中；如果配置了 object，表示获取对应存储桶中 object 对应的代码进行部署 |
| object   |  否  |     string      |        | 部署的代码在存储桶中的路径。                                                                                                                          |

### 环境变量

| 参数名称  | 类型                              | 描述                                      |
| --------- | --------------------------------- | ----------------------------------------- |
| variables | Array of [Variable][函数环境变量] | 环境变量参数，包含多对 key-value 的键值对 |

### 私有网络

| 参数名称 | 必选 | 类型   | 描述           |
| -------- | ---- | ------ | -------------- |
| subnetId | 否   | string | 子网的 Id      |
| vpcId    | 否   | string | 私有网络 的 Id |

### 死信队列

| 名称       | 必选 | 类型   | 描述                       |
| :--------- | ---- | :----- | :------------------------- |
| Type       | 是   | string | 死信队列模式               |
| Name       | 是   | string | 死信队列名称               |
| FilterType | 否   | string | 死信队列主题模式的标签形式 |

### 层配置

| 参数名称 | 必选 |  类型  | 描述     |
| -------- | :--: | :----: | :------- |
| name     |  是  | string | 层名称   |
| version  |  是  | number | 层版本号 |

### 函数日志

| 参数名称 | 必选 |  类型  | 描述                          |
| -------- | :--: | :----: | :---------------------------- |
| logsetId |  否  | string | 函数日志投递到的 CLS LogsetID |
| topicId  |  否  | string | 函数日志投递到的 CLS TopicID  |

### 文件系统

使用文件系统必须配置[私有网络](#私有网络)，并保证 cfs 文件系统与云函数在同一个私有网络下。

| 参数名称       | 必选 |  类型  | 描述              |
| -------------- | :--: | :----: | :---------------- |
| cfsId          |  是  | String | 文件系统实例 id   |
| mountInsId     |  是  | String | 文件系统挂载点 id |
| localMountDir  |  是  | String | 本地挂载点        |
| remoteMountDir |  是  | String | 远程挂载点        |

### 触发器

参考： https://cloud.tencent.com/document/product/583/39901

触发器配置为数组，按照配置的 name 和 param 创建触发器。对于 apigw 触发器，如果没有配置 apigw 服务 ID，则自动创建一个 apigw 服务，对于其他触发器仅执行配置触发器，不涉及服务资源创建。

支持以下触发器：timer（定时触发器）、apigw（网关触发器）、cos（COS 触发器）、cmq（CMQ Topic 触发器）、ckafka（CKafka 触发器）。

| 参数名称   | 必选 |  类型  |                默认值                | 描述                                   |
| ---------- | :--: | :----: | :----------------------------------: | :------------------------------------- |
| name       |  是  | string | `触发器类型-${name}-${stage}-${app}` | 触发器名称。                           |
| parameters |  是  | object |                                      | 根据触发器类型，参考以下触发器参数表。 |

#### timer 触发器参数

参考： https://cloud.tencent.com/document/product/583/9708

| 参数名称       | 必选 |  类型   |   默认值   | 描述                                             |
| -------------- | :--: | :-----: | :--------: | :----------------------------------------------- |
| qualifier      |  否  | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`       |
| cronExpression |  是  | number  |            | 触发时间，为 [Cron][定时触发器-cron表达式]表达式 |
| argument       |  否  | object  |            | 入参参数。                                       |
| enable         |  否  | boolean |  `false`   | 触发器是否启用                                   |

#### cos 触发器参数

参考： https://cloud.tencent.com/document/product/583/9707

| 参数名称  | 必选 |           类型           |   默认值   | 描述                                               |
| --------- | :--: | :----------------------: | :--------: | :------------------------------------------------- |
| qualifier |  否  |          string          | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`         |
| bucket    |  是  |          string          |            | 配置的 COS Bucket，仅支持选择同地域下的 COS 存储桶 |
| filter    |  是  | [CosFilter][cos过滤规则] |            | COS 文件名的过滤规则                               |
| events    |  是  |          string          |            | [COS 的事件类型][cos事件类型]                      |
| enable    |  否  |         boolean          |  `false`   | 触发器是否启用                                     |

#### cmq 触发器参数

| 参数名称   | 必选 | 类型     | 默认值     | 描述                                                                         |
| ---------- | ---- | -------- | ---------- | :--------------------------------------------------------------------------- |
| qualifier  | 否   | string   | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                                   |
| name       | 是   | string   |            | CMQ Topic 主题队列名称                                                       |
| filterType | 否   | number   |            | 消息过滤类型，1 为标签类型，2 为路由匹配类型                                 |
| filterKey  | 否   | string[] |            | 当 filterType 为 1 时表示消息过滤标签，当 filterType 为 2 时表示 Binding Key |
| enable     | 否   | boolean  | `false`    | 触发器是否启用                                                               |

#### ckafka 触发器参数

| 参数名称  | 必选 | 类型    | 默认值     | 描述                                                       |
| --------- | ---- | ------- | ---------- | :--------------------------------------------------------- |
| qualifier | 否   | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                 |
| name      | 是   | string  |            | 配置连接的 CKafka 实例，仅支持选择同地域下的实例。         |
| topic     | 是   | string  |            | 支持在 CKafka 实例中已经创建的 Topic。                     |
| maxMsgNum | 是   | number  |            | 5 秒内每汇聚 maxMsgNum 条 Ckafka 消息，则触发一次函数调用  |
| offset    | 是   | string  |            | offset 为开始消费 Ckafka 消息的位置，目前只能填写 `latest` |
| retry     | 是   | number  |            | 重试次数，函数调用失败时的最大重试次数。                   |
| enable    | 否   | boolean | `false`    | 触发器是否启用                                             |

#### apigw 触发器参数

| 参数名称    | 必选 |   类型   | 默认值      | 描述                                                                           |
| ----------- | ---- | :------: | :---------- | :----------------------------------------------------------------------------- |
| environment | 否   |  string  | `release`   | 发布的环境，填写 `release`、`test` 或 `prepub`，不填写默认为`release`          |
| serviceId   | 否   |  string  |             | 网关 Service ID（不传入则新建一个 Service）                                    |
| protocols   | 否   | string[] | `['http']`  | 前端请求的类型，如 http，https，http 与 https                                  |
| netTypes    | 否   | string[] | `['OUTER']` | 网络类型，如 `['OUTER']`, `['INNER']` 与`['OUTER', 'INNER']`                   |
| serviceName | 否   |  string  |             | 网关 API 名称。如果不传递则默认新建一个名称与触发器名称相同的 Apigw API 名称。 |
| description | 否   |  string  |             | 网关 API 描述                                                                  |
| endpoints   | 是   | object[] |             | 参考 [endpoint](#endpoints-参数) 参数。                                        |

##### endpoints 参数

参考： https://cloud.tencent.com/document/product/628/14886

| 参数名称                  | 必选 |            类型             | 默认值  | 描述                                                                                                      |
| ------------------------- | ---- | :-------------------------: | :------ | :-------------------------------------------------------------------------------------------------------- |
| path                      | 是   |           string            |         | API 的前端路径，如/path。                                                                                 |
| method                    | 否   |           string            |         | API 的前端请求方法，如 GET                                                                                |
| apiId                     | 否   |           string            |         | API ID。如果不传递则根据 path 和 method 创建一个，传递了直接忽略 path 和 method 参数。                    |
| apiName                   | 否   |           string            |         | API 名称                                                                                                  |
| description               | 否   |           string            |         | API 描述                                                                                                  |
| enableCORS                | 是   |           boolean           | `false` | 是否需要开启跨域                                                                                          |
| responseType              | 否   |           string            |         | 自定义响应配置返回类型，现在只支持 HTML、JSON、TEST、BINARY、XML（此配置仅用于生成 API 文档提示调用者）。 |
| serviceTimeout            | 是   |           number            | `15`    | API 的后端服务超时时间，单位是秒。                                                                        |
| param                     | 否   |   [Parameter](#Parameter)   |         | 前端参数                                                                                                  |
| function                  | 否   |    [Function](#Function)    |         | SCF 配置                                                                                                  |
| usagePlan                 | 否   |   [UsagePlan](#UsagePlan)   |         | 使用计划                                                                                                  |
| auth                      | 否   |        [Auth](#Auth)        |         | API 密钥配置                                                                                              |
| isBase64Encoded           | 否   |           boolean           | `false` | 是否开启 Base64 编码，只有后端为 scf 时才会生效                                                           |
| isBase64Trigger           | 否   |           boolean           | `false` | 是否开启 Base64 编码的 header 触发，只有后端为 scf 时才会生效                                             |
| base64EncodedTriggerRules | 否   | [Base64Rule](#Base64Rule)[] | []      | Header 触发 Base64 编码规则，总规则数不能超过 10，只有 `isBase64Trigger` 设置为 `true` 才有效             |

###### Parameter

前端参数

| 参数名称     | 必选 | 类型    | 默认值 | 描述                                                      |
| ------------ | ---- | ------- | ------ | --------------------------------------------------------- |
| name         | 否   | string  |        | API 的前端参数名称。                                      |
| position     | 否   | string  |        | API 的前端参数位置。当前仅支持 PATH、QUERY、HEADER        |
| required     | 否   | boolean |        | API 的前端参数是否必填，true：表示必填，false：表示可选。 |
| type         | 否   | string  |        | API 的前端参数类型，如 String、Int 等。                   |
| defaultValue | 否   | string  |        | API 的前端参数默认值。                                    |
| desc         | 否   | string  |        | API 的前端参数备注。                                      |

###### Function

SCF 配置

| 参数名称             | 必选 | 类型    | 默认值     | 描述                     |
| -------------------- | ---- | ------- | ---------- | ------------------------ |
| isIntegratedResponse | 否   | boolean | `false`    | 是否启用 SCF 集成响应。  |
| functionQualifier    | 否   | string  | `$DEFAULT` | 触发器关联的 SCF 版本 。 |

###### UsagePlan

使用计划

参考: https://cloud.tencent.com/document/product/628/14947

| 参数名称      | 必选 | 类型   | 描述                                                    |
| ------------- | :--: | ------ | :------------------------------------------------------ |
| usagePlanId   |  否  | string | 用户自定义使用计划 ID                                   |
| usagePlanName |  否  | string | 用户自定义的使用计划名称                                |
| usagePlanDesc |  否  | string | 用户自定义的使用计划描述                                |
| maxRequestNum |  否  | number | 请求配额总数，如果为空，将使用-1 作为默认值，表示不开启 |

###### Auth

API 密钥配置

参考: https://cloud.tencent.com/document/product/628/14916

| 参数名称   | 类型   | 描述     |
| ---------- | :----- | :------- |
| secretName | string | 密钥名称 |
| secretIds  | string | 密钥 ID  |

###### Base64Rule

Header 触发 Base64 编码规则，总规则数不能超过 10，只有 `isBase64Trigger` 设置为 `true` 才有效

参考: https://tcloud-dev.oa.com/document/product/628/16924?!preview&preview_docmenu=1&lang=cn&!document=1#Base64EncodedTriggerRule

| 参数名称 | 类型     | 描述                                                                                                                                          |
| -------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| name     | string   | 进行编码触发的 header，可选值 "Accept"和"Content_Type" 对应实际数据流请求 header 中的 Accept 和 Content-Type                                  |
| value    | string[] | 进行编码触发的 header 的可选值数组, 数组元素的字符串最大长度为 40，元素可以包括数字，英文字母以及特殊字符，特殊字符的可选值为： . + \* - / \_ |

例如 `value` 可以配置为：

```yaml
value:
  - application/zip
```

#### CLS 触发器

| 参数名称  | 必选 | 类型    | 默认值     | 描述                                       |
| --------- | ---- | ------- | ---------- | :----------------------------------------- |
| qualifier | 否   | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量` |
| topicId   | 是   | string  |            | CLS 日志主题 ID                            |
| maxWait   | 否   | number  | `60`       | 最长等待时间，单位秒                       |
| enable    | 否   | boolean | `false`    | 触发器是否启用                             |

#### MPS 触发器

| 参数名称  | 必选 | 类型    | 默认值     | 描述                                                                  |
| --------- | ---- | ------- | ---------- | :-------------------------------------------------------------------- |
| qualifier | 否   | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                            |
| type      | 是   | string  |            | 事件类型。`WorkflowTask - 工作流任务`，`EditMediaTask - 视频编辑任务` |
| enable    | 否   | boolean | `false`    | 触发器是否启用                                                        |

> 注意：添加 mps 触发器，需要给 `SLS_QcsRole` 添加 `QcloudMPSFullAccess` 策略。

## 关于 API 网关 Base64 编码

> 注意：开启 API 网关 Base64 编码的后端必须是 `云函数`

如果需要开启 API 网关 Base64 编码，必须配置 `isBase64Encoded` 为 `true`，此时每次请求的请求内容都会被 Base64 编码后再传递给云函数。如果想要部分请求 Base64 编码，可以通过配置 `isBase64Trigger` 为 `true`，配置 `base64EncodedTriggerRules` Header 触发规则，此时 API 网关将根据触发规则对请求头进行校验，只有拥有特定 Content-Type 或 Accept 请求头的请求会被 Base64 编码后再传递给云函数，不满足条件的请求将不进行 Base64 编码，直接传递给云函数。
官方介绍文档：https://cloud.tencent.com/document/product/628/51799

<!-- Refer links -->

[函数角色与授权]: https://cloud.tencent.com/document/product/583/32389#.E8.A7.92.E8.89.B2.E8.AF.A6.E6.83.85
[函数地域列表]: https://cloud.tencent.com/document/api/583/17238#.E5.9C.B0.E5.9F.9F.E5.88.97.E8.A1.A8
[glob语法参考]: https://github.com/isaacs/node-glob
[函数环境变量]: https://cloud.tencent.com/document/api/583/17244#Variable
[定时触发器-cron表达式]: https://cloud.tencent.com/document/product/583/9708#cron-.E8.A1.A8.E8.BE.BE.E5.BC.8F
[cos过滤规则]: https://cloud.tencent.com/document/product/583/39901#CosFilter
[cos事件类型]: https://cloud.tencent.com/document/product/583/9707#cos-.E8.A7.A6.E5.8F.91.E5.99.A8.E5.B1.9E.E6.80.A7
[固定出口ip]: https://cloud.tencent.com/document/product/583/38198
[customruntime]: https://cloud.tencent.com/document/product/583/47274
