# serverless cloud funtion

Deploy scf functions to tencent in seconds with [Serverless Components](https://github.com/serverless/components).

&nbsp;

* [请点击这里查看中文版部署文档](./README_CN.md)

&nbsp;

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

```
$ mkdir my-function
$ cd my-function
```
the directory should look something like this:
```
|- code
  |- index.js
|- serverless.yml
|- .env      # your Tencent SecretId/Key/AppId
```

Add the access keys of a [Tencent CAM Role](https://console.cloud.tencent.com/cam/capi) with `AdministratorAccess` in the `.env` file, using this format: 

```
# .env
TENCENT_SECRET_ID=XXX
TENCENT_SECRET_KEY=XXX
```
* If you don't have a Tencent Cloud account, you could [sign up](https://intl.cloud.tencent.com/register) first. 

For this example, you could add the code to index.js file:
```javascript
'use strict';
exports.main_handler = async (event, context, callback) => {
    console.log("%j", event);
    return "hello world"
};

```


### 3. Configure

```yml
# serverless.yml

myFunction:
  component: "@serverless/tencent-scf"
  inputs:
    name: myFunction
    codeUri: ./code
    handler: index.main_handler
    runtime: Nodejs8.9
    region: ap-guangzhou


```
* [Click here to view the configuration document](https://github.com/serverless-tencent/tencent-scf/blob/master/docs/configure.md)


### 4. Deploy

```console
$ sls --debug

  DEBUG ─ Resolving the template's static variables.
  DEBUG ─ Collecting components from the template.
  DEBUG ─ Downloading any NPM components found in the template.
  DEBUG ─ Analyzing the template's components dependencies.
  DEBUG ─ Creating the template's components graph.
  DEBUG ─ Syncing template state.
  DEBUG ─ Starting Website Removal.
  DEBUG ─ Removing Website bucket.
  DEBUG ─ Removing files from the "my-bucket-1300415943" bucket.
  DEBUG ─ Removing "my-bucket-1300415943" bucket from the "ap-guangzhou" region.
  DEBUG ─ "my-bucket-1300415943" bucket was successfully removed from the "ap-guangzhou" region.
  DEBUG ─ Finished Website Removal.
  DEBUG ─ Executing the template's components graph.
  DEBUG ─ Compressing function myFunction file to /Users/dfounderliu/Desktop/temp/code/.serverless/myFunction.zip.
  DEBUG ─ Compressed function myFunction file successful
  DEBUG ─ Uploading service package to cos[sls-cloudfunction-ap-guangzhou-code]. sls-cloudfunction-default-myFunction-1572519895.zip
  DEBUG ─ Uploaded package successful /Users/dfounderliu/Desktop/temp/code/.serverless/myFunction.zip
  DEBUG ─ Creating function myFunction
  DEBUG ─ Created function myFunction successful

  myFunction: 
    Name:        myFunction
    Runtime:     Nodejs8.9
    Handler:     index.main_handler
    MemorySize:  128
    Timeout:     3
    Region:      ap-guangzhou
    Role:        QCS_SCFExcuteRole
    Description: This is a template function
    UsingCos:    true

  6s › myFunction › done

```

### 5. Remove

```console
$ sls remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removed function myFunction successful

  1s › myFunction › done

```


### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
