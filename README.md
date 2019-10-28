# serverless cloud funtion

Deploy scf functions to tencent in seconds with [Serverless Components](https://github.com/serverless/components).


1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)
5. [Remove](#5-remove)

&nbsp;

### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

Just create `serverless.yml` and `.env` files

```console
$ touch serverless.yml
$ touch .env # your Tencent API Keys
```

Set Tencent credentials in the `.env` file.

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```

### 3. Configure

```yml
# serverless.yml
myFunction1:
  component: "@serverless/tencent-scf"
  inputs:
    name: myFunction1
    # code dir path
    codeUri: ./code
    handler: index.main_handler
    runtime: Nodejs8.9  // If the function has been established, no modification is allowed
    region: ap-guangzhou  // If the function has been established, change area will cause the function to redeploy
    description: My Serverless Function
    memorySize: 128
    timeout: 20
    # zip compress ignore file or directory
    exclude:
      - .gitignore
      - .git/**
      - node_modules/**
      - .serverless
      - .env
    include:
          - /Users/dfounderliu/Desktop/temp/.serverless/myFunction1.zip
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
    # code dir path
    codeUri: ./code
   

```

### 4. Deploy

```console
$ serverless --debug
```

### 5. Remove

```console
$ serverless remove --debug
```

### Test
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

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
