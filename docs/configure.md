# 配置文档

## 全部配置

```yml
# serverless.yml

#应用组织信息
app: '' # 应用名称。留空则默认取当前组件的实例名称为app名称。
stage: '' # 环境名称。默认值是 dev。建议使用${env.STAGE}变量定义环境名称

#组件信息
component: scf # (必选) 组件名称，在该实例中为scf
name: scfdemo # (必选) 组件实例名称。

#组件参数配置
inputs:
  name: scfdemo # 云函数名称，默认为 ${name}-${stage}-${app}
  namespace: default
  role: exRole # 云函数执行角色
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
  type: event # 函数类型，默认为 event(事件类型)，web(web类型)
  handler: index.main_handler #入口（函数类型为事件类型时生效）
  entryFile: app.js #入口文件名（代码中无scf_bootstrap文件，且函数类型为web类型时生效）
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
  installDependency: false # 是否在线安装依赖
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
  asyncRunEnable: false # 是否启用异步执行（长时间运行）
  traceEnable: false # 是否状态追踪
  tags: #标签配置
    key1: value1
    key2: value2 # tags 的key value
  ignoreTriggers: false # 是否忽略触发器部署
  image: # 镜像配置
    registryId: tcr-xxx # 容器镜像服务名称，企业版必须
    imageType: personal # 镜像类型：personal - 个人，enterprise - 企业版，public - 镜像模板
    imageUri: ccr.ccs.tencentyun.com/sls-scf/nodejs_test:latest@sha256:xxx
    command: node index.js # 容器启动命名
    args: test # 容器启动参数
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
          name: ckafka-xxx
          topic: test
          maxMsgNum: 999
          retry: 10000
          offset: latest
          timeout: 60
          enable: true
    - cls: # cls 触发器
        parameters:
          qualifier: '$DEFAULT' # 别名配置
          topicId: 'xxx-228b-42f5-aab5-7f740cc2fb11' # 日志主题 ID
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

| 参数名称          | 必选 | 类型                        | 默认值               | 描述                                                                                                                                  |
| ----------------- | ---- | --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| src               | 是   | [Src](#Src)                 |                      | 函数代码路径。                                                                                                                        |
| type              | 否   | string                      | `event`              | 函数类型，支持：event、web                                                                                                            |
| name              | 否   | string                      |                      | 创建的函数名称                                                                                                                        |
| namespace         | 否   | string                      | `default`            | 函数命名空间                                                                                                                          |
| handler           | 否   | string                      | `index.main_handler` | 函数处理方法名称，执行方法表明了调用云函数时需要从哪个文件中的哪个函数开始执行（函数类型为 web 时生效）                               |
| entryFile         | 否   | string                      |                      | 函数入口文件名，默认根据运行环境指定默认文件名。Nodejs 为 app.js，Python 环境为 app.py，php 环境为 hello.php（函数类型为 web 时生效） |
| role              | 否   | string                      |                      | 云函数绑定的运行角色。                                                                                                                |
| runtime           | 否   | string                      | `Nodejs10.15`        | 函数运行环境 （web 函数目前仅支持 Nodejs、Python、Php 三类环境）                                                                      |
| region            | 否   | string                      | `ap-guangzhou`       | 云函数所在区域。详见产品支持的 [地域列表][函数地域列表]。                                                                             |
| description       | 否   | string                      |                      | 函数描述,最大支持 1000 个英文字母、数字、空格、逗号、换行符和英文句号，支持中文                                                       |
| memorySize        | 否   | number                      | `128`                | 函数运行时内存大小，可选范围 64、128MB-3072MB，并且以 128MB 为阶梯                                                                    |
| timeout           | 否   | number                      | `3`                  | 函数最长执行时间，单位为秒，可选值范围 1-900 秒                                                                                       |
| initTimeout       | 否   | number                      | `3`                  | 函数初始化超时时间，单位为秒，可选值范围 1-30 秒 秒                                                                                   |
| eip               | 否   | boolean                     | `false`              | 是否[固定出口 IP][固定出口ip]                                                                                                         |
| publicAccess      | 否   | number                      | `true`               | 是否开启公网访问                                                                                                                      |
| environment       | 否   | [Environment](#Environment) |                      | 函数的环境变量，配置参考[环境变量](#环境变量)                                                                                         |
| vpcConfig         | 否   | [Vpc](#Vpc)                 |                      | 函数的私有网络配置，配置参数参考[私有网络](#私有网络)                                                                                 |
| layers            | 否   | [Layer](#Layer)[]           |                      | 云函数绑定的 layer, 配置参数参考[层配置](#层配置)                                                                                     |
| deadLetter        | 否   | [DeadLetter](#DeadLetter)   |                      | 死信队列配置，配置参数参考[死信队列](#死信队列)                                                                                       |
| cls               | 否   | [Cls](#Cls)                 |                      | 函数日志配置，配置参数参考[函数日志](#函数日志)                                                                                       |
| eip               | 否   | boolean                     | `false`              | 固定出口 IP。默认为 false，即不启用。                                                                                                 |
| asyncRunEnable    | 否   | boolean                     | `false`              | 是否启用异步执行（长时间运行），默认最大支持 `12小时`，如果配置为 `true`，`cls`（函数日志配置） 必须。`此参数只有在函数创建时才有效`  |
| traceEnable       | 否   | boolean                     | `false`              | 是否启用状态追踪，如果要配置为 `true`，必须配置 `asyncRunEnable` 同时为 `true`                                                        |
| installDependency | 否   | boolean                     | `false`              | 是否自动在线安装依赖                                                                                                                  |
| tags              | 否   |                             |                      | 标签设置。可设置多对 key-value 的键值对                                                                                               |
| cfs               | 否   | [Cfs](#Cfs)                 |                      | 文件系统挂载配置，用于云函数挂载文件系统。配置参数参考[文件系统](#文件系统)。                                                         |
| ignoreTriggers    | 否   | boolean                     | `false`              | 是否忽略触发器，如果设置为 `true`，`events` 参数将不起作用，组件将至更新函数配置和代码                                                |
| events            | 否   | [Event](#Event)[]           |                      | 触发器配置                                                                                                                            |
| image             | 否   | [Image](#Image)             |                      | 镜像配置                                                                                                                              |

**重要字段说明**

- name - 云函数名称，字段字符需满足 `只能包含字母、数字、下划线、连字符，以字母开头，以数字或字母结尾，2~60个字符`
- runtime - 目前仅支持: `Nodejs6.10，Nodejs8.9，Nodejs10.15，Nodejs12.16，Python2.7，Python3.6，PHP5，PHP7，Go1，Java8 和 CustomRuntime`，使用 `CustomRuntime` 部署参考 [CustomRuntime][customruntime]

### Src

代码目录

| 参数名称 | 必选 |   类型   | 默认值 | 描述                                               |
| -------- | :--: | :------: | :----: | :------------------------------------------------- |
| src      |  是  |  string  |        | 代码路径。与 object 不能同时存在。                 |
| exclude  |  否  | string[] |        | 不包含的文件或路径, 遵守 [glob 语法][glob语法参考] |
| bucket   |  否  |  string  |        | 存储桶名称                                         |
| object   |  否  |  string  |        | 部署的代码在存储桶中的路径。                       |

> 注意：如果配置了 `src`，表示部署 `src` 参数指定目录的代码并压缩成 `zip` 后上传到对应的存储桶中；如果配置了 `object`，表示获取对应存储桶中 `object` 对应的代码进行部署

### Environment

环境变量

| 参数名称  | 类型                              | 描述                                      |
| --------- | --------------------------------- | ----------------------------------------- |
| variables | Array of [Variable][函数环境变量] | 环境变量参数，包含多对 key-value 的键值对 |

### Vpc

私有网络

| 参数名称 | 必选 | 类型   | 描述           |
| -------- | ---- | ------ | -------------- |
| vpcId    | 否   | string | 私有网络 的 Id |
| subnetId | 否   | string | 子网的 Id      |

### DeadLetter

死信队列

| 名称       | 必选 | 类型   | 描述                       |
| :--------- | ---- | :----- | :------------------------- |
| Type       | 是   | string | 死信队列模式               |
| Name       | 是   | string | 死信队列名称               |
| FilterType | 否   | string | 死信队列主题模式的标签形式 |

### Layer

层配置

| 参数名称 | 必选 |  类型  | 描述     |
| -------- | :--: | :----: | :------- |
| name     |  是  | string | 层名称   |
| version  |  是  | number | 层版本号 |

### Cls

函数日志

| 参数名称 | 必选 |  类型  | 描述        |
| -------- | :--: | :----: | :---------- |
| logsetId |  否  | string | 日志集 ID   |
| topicId  |  否  | string | 日志主题 ID |

### Cfs

文件系统，使用文件系统必须配置[私有网络](#私有网络)，并保证 cfs 文件系统与云函数在同一个私有网络下。

| 参数名称       | 必选 |  类型  | 描述              |
| -------------- | :--: | :----: | :---------------- |
| cfsId          |  是  | String | 文件系统实例 id   |
| mountInsId     |  是  | String | 文件系统挂载点 id |
| localMountDir  |  是  | String | 本地挂载点        |
| remoteMountDir |  是  | String | 远程挂载点        |

### Event

触发器，触发器配置为数组，按照配置的 name 和 param 创建触发器。

支持以下触发器：

```
timer - 定时触发器
apigw - API 网关触发器
cos - COS 触发器
cmq - CMQ 主题订阅触发器
ckafka - CKafka 触发器
cls - CLS 触发器
mps - MPS 触发器
```

> **注意**：对于 `API 网关触发器`，如果没有配置 网关服务 ID （serviceId），则自动创建一个 API 网关服务，对于其他触发器仅执行配置触发器，不涉及服务资源创建。

| 参数名称   | 必选 |  类型  |                默认值                | 描述                                   |
| ---------- | :--: | :----: | :----------------------------------: | :------------------------------------- |
| parameters |  是  | object |                                      | 根据触发器类型，参考以下触发器参数表。 |
| name       |  否  | string | `触发器类型-${name}-${stage}-${app}` | 触发器名称。                           |

参考 [官方触发器配置描述](https://cloud.tencent.com/document/product/583/39901)

#### 定时触发器

参考： https://cloud.tencent.com/document/product/583/9708

| 参数名称       | 必选 |  类型   |   默认值   | 描述                                             |
| -------------- | :--: | :-----: | :--------: | :----------------------------------------------- |
| qualifier      |  否  | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`       |
| cronExpression |  是  | number  |            | 触发时间，为 [Cron][定时触发器-cron表达式]表达式 |
| argument       |  否  | object  |            | 入参参数。                                       |
| enable         |  否  | boolean |  `false`   | 触发器是否启用                                   |

#### COS 触发器

参考： https://cloud.tencent.com/document/product/583/9707

| 参数名称  | 必选 |           类型           |   默认值   | 描述                                               |
| --------- | :--: | :----------------------: | :--------: | :------------------------------------------------- |
| qualifier |  否  |          string          | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`         |
| bucket    |  是  |          string          |            | 配置的 COS Bucket，仅支持选择同地域下的 COS 存储桶 |
| filter    |  是  | [CosFilter][cos过滤规则] |            | COS 文件名的过滤规则                               |
| events    |  是  |          string          |            | [COS 的事件类型][cos事件类型]                      |
| enable    |  否  |         boolean          |  `false`   | 触发器是否启用                                     |

#### CMQ 触发器

| 参数名称   | 必选 | 类型     | 默认值     | 描述                                                                         |
| ---------- | ---- | -------- | ---------- | :--------------------------------------------------------------------------- |
| qualifier  | 否   | string   | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                                   |
| name       | 是   | string   |            | CMQ Topic 主题队列名称                                                       |
| filterType | 否   | number   |            | 消息过滤类型，1 为标签类型，2 为路由匹配类型                                 |
| filterKey  | 否   | string[] |            | 当 filterType 为 1 时表示消息过滤标签，当 filterType 为 2 时表示 Binding Key |
| enable     | 否   | boolean  | `false`    | 触发器是否启用                                                               |

> 注意：添加 CMQ 触发器，需要给 `SLS_QcsRole` 添加 `QcloudCMQFullAccess` 策略。

#### Ckafka 触发器

| 参数名称  | 必选 | 类型    | 默认值     | 描述                                                       |
| --------- | ---- | ------- | ---------- | :--------------------------------------------------------- |
| qualifier | 否   | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                 |
| name      | 是   | string  |            | 配置连接的 CKafka 实例，仅支持选择同地域下的实例。         |
| topic     | 是   | string  |            | 支持在 CKafka 实例中已经创建的 Topic。                     |
| maxMsgNum | 是   | number  | `100`      | 5 秒内每汇聚 maxMsgNum 条 Ckafka 消息，则触发一次函数调用  |
| offset    | 是   | string  | `latest`   | offset 为开始消费 Ckafka 消息的位置，目前只能填写 `latest` |
| retry     | 是   | number  | `10000`    | 重试次数，函数调用失败时的最大重试次数。                   |
| timeout   | 是   | number  | `60`       | 单次触发的最长等待时间，最大 60 秒                         |
| enable    | 否   | boolean | `false`    | 触发器是否启用                                             |

> 注意：添加 CKafka 触发器，需要给 `SLS_QcsRole` 添加 `QcloudCKafkaFullAccess` 策略。

#### API 网关触发器

| 参数名称    | 必选 |   类型   | 默认值      | 描述                                                                           |
| ----------- | ---- | :------: | :---------- | :----------------------------------------------------------------------------- |
| environment | 否   |  string  | `release`   | 发布的环境，填写 `release`、`test` 或 `prepub`，不填写默认为`release`          |
| serviceId   | 否   |  string  |             | 网关 Service ID（不传入则新建一个 Service）                                    |
| protocols   | 否   | string[] | `['http']`  | 前端请求的类型，如 http，https，http 与 https                                  |
| netTypes    | 否   | string[] | `['OUTER']` | 网络类型，如 `['OUTER']`, `['INNER']` 与`['OUTER', 'INNER']`                   |
| serviceName | 否   |  string  |             | 网关 API 名称。如果不传递则默认新建一个名称与触发器名称相同的 Apigw API 名称。 |
| description | 否   |  string  |             | 网关 API 描述                                                                  |
| endpoints   | 是   | object[] |             | 参考 [endpoint](#endpoints-参数) 参数。                                        |

> 注意：如果配置多个 API 网关触发器，需要配置不同的 `serviceName`

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

> 注意：添加 CLS 触发器，需要给 `SLS_QcsRole` 添加 `QcloudCLSFullAccess` 策略。

#### MPS 触发器

| 参数名称  | 必选 | 类型    | 默认值     | 描述                                                                  |
| --------- | ---- | ------- | ---------- | :-------------------------------------------------------------------- |
| qualifier | 否   | string  | `$DEFAULT` | 触发版本，默认为 `$DEFAULT`，即 `默认流量`                            |
| type      | 是   | string  |            | 事件类型。`WorkflowTask - 工作流任务`，`EditMediaTask - 视频编辑任务` |
| enable    | 否   | boolean | `false`    | 触发器是否启用                                                        |

> 注意：添加 MPS 触发器，需要给 `SLS_QcsRole` 添加 `QcloudMPSFullAccess` 策略。

## 关于 API 网关 Base64 编码

> 注意：开启 API 网关 Base64 编码的后端必须是 `云函数`

如果需要开启 API 网关 Base64 编码，必须配置 `isBase64Encoded` 为 `true`，此时每次请求的请求内容都会被 Base64 编码后再传递给云函数。如果想要部分请求 Base64 编码，可以通过配置 `isBase64Trigger` 为 `true`，配置 `base64EncodedTriggerRules` Header 触发规则，此时 API 网关将根据触发规则对请求头进行校验，只有拥有特定 Content-Type 或 Accept 请求头的请求会被 Base64 编码后再传递给云函数，不满足条件的请求将不进行 Base64 编码，直接传递给云函数。
官方介绍文档：https://cloud.tencent.com/document/product/628/51799

### Image

镜像相关配置：

| 参数名称   | 必选 | 类型   | 默认值     | 描述                                                   |
| ---------- | ---- | ------ | ---------- | :----------------------------------------------------- |
| imageUrl   | 是   | string |            | 镜像版本 URL                                           |
| registryId | 否   | string |            | [容器镜像服务][tcr] 实例 ID，使用企业版镜像时必须      |
| imageType  | 否   | string | `personal` | 镜像类型，支持：personal、enterprise、public           |
| command    | 否   | string |            | 容器启动命令，默认使用镜像中的 `Entrypoint` 或者 `CMD` |
| args       | 否   | string |            | 容器启动参数，默认使用惊醒中的 `CMD`                   |

注意：

`imageUrl` 拼接格式为 `<仓库地址>:<镜像版本>@<镜像ID(sha256)>`，如下：

```text
ccr.ccs.tencentyun.com/sls-scf/nodejs_test:latest@sha256:xxx
```

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
[clb重定向配置]: https://cloud.tencent.com/document/product/214/8839
[tcr]: https://console.cloud.tencent.com/tcr/
