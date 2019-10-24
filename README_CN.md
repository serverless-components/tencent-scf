# 腾讯云云函数SCF组件

## 简介
该组件是serverless-tencent组件库中的基础组件之一。通过云函数SCF组件，可以快速，方便的创建，配置和管理腾讯云的SCF云函数。

## 快速开始
&nbsp;

通过SCF组件，对一个云函数进行完整的创建，配置，部署和删除等操作。支持命令如下：

1. [安装](#1-安装)
2. [创建](#2-创建)
3. [配置](#3-配置)
4. [部署](#4-部署)
5. [移除](#5-移除)

&nbsp;

### 1. 安装

通过npm安装serverless

```console
$ npm install -g serverless
```

### 2. 创建

本地创建 `serverless.yml` 和 `.env` 两个文件

```console
$ touch serverless.yml
$ touch .env # 腾讯云的配置信息
```

在 `.env` 文件中配置腾讯云的APPID，SecretId和SecretKey信息并保存

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```
### 3. 配置

在serverless.yml中进行如下配置

```yml
# serverless.yml
myFunction1:
  component: "@serverless/tencent-cloudfunction"
  inputs:
    name: myFunction1
    codeUri: ./code       # 代码目录
    handler: index.main_handler
    runtime: Nodejs8.9
    region: ap-guangzhou
    description: My Serverless Function
    memorySize: 128
    timeout: 20
    # 打包zip时希望忽略的文件或者目录配置（可选）
    ignores:
      - .gitignore
      - .git/**
      - node_modules/**
      - .serverless
      - .env
    environment:
      variables:
        TEST: vale
    vpcConfig:
      subnetId: ''
      vpcId: ''

myFunction2:
  component: "@serverless/tencent-cloudfunction"
  inputs:
    name: myFunction2
    codeUri: ./code

```

### 4. 部署

通过如下命令进行部署，并查看部署过程中的信息
```console
$ serverless --debug
```

### 5. 移除

通过以下命令移除部署的云函数
```console
$ serverless remove --debug
```

### 测试案例
```text
DFOUNDERLIU-MB0:temp dfounderliu$ sls

  myFunction1: 
    Name:        myFunction1
    Runtime:     Nodejs8.9
    Handler:     index.main_handler
    MemorySize:  128
    Timeout:     200
    Region:      ap-guangzhou
    Role:        QCS_SCFExcuteRole
    Description: My Serverless Function
    UsingCos:    true
    CodeSize:    243 B

  3s › myFunction1 › done

DFOUNDERLIU-MB0:temp dfounderliu$ sls remove

  14s › myFunction1 › done

```
### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
