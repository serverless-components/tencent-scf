# Configure document

## Complete configuration

```yml
# serverless.yml

myFunction:
  component: "@serverless/tencent-scf"
  inputs:
    name: myFunction1
    enableRoleAuth: ture
    codeUri: ./code
    handler: index.main_handler
    runtime: Nodejs8.9
    region: ap-guangzhou
    description: My Serverless Function
    memorySize: 128
    timeout: 20
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
         
```

## Configuration description

Main param description

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----      |
| name       | Required             | | Name of the new function. The name: must be between 2 and 60 characters long; can contain any letters (both uppercase and lowercase) from a to z and any numbers from 0 through 9; can contain some special characters, including hyphen or dash, and underscore; must begin with a letter and be unique, and must not end with an underscore or a dash. |
| codeUri | Required             |             | Function code path|
| enableRoleAuth  | Required             |             | Default `true`, enable role and policies for SCF to get access to related services |
| handler  | Required             |             | Name of the handler. A handler is a method that the runtime executes when your function is invoked. A handler name must be formatted as the function name following the file name with a period (.) between these two names, for example, FileName.FunctionName. Both file name and function name: must be between 2 and 60 characters long; can contain any letters (both uppercase and lowercase) from a to z and any numbers from 0 through 9, can contain some special characters, including hyphen or dash, and underscore; must begin and end with a letter. |
| runtime    | Required             |             | Runtime environment of the function; supported environment: Python2.7 (default), Python3.6, Nodejs6.10, PHP5, PHP7, Golang1 and Java8. |
| region         | Optional             |    ap-guangzhou          |  |
| description         | Optional             |             | Description of the function. The description can be up to 1,000 characters long and can contain any letters (both uppercase and lowercase) from a to z, any numbers from 0 through 9, spaces, line breaks, commas and period. Chinese characters are also supported. |
| memorySize         | Optional             |     128M        | The size of memory size available to the function during execution. Specify a value between 128 MB (default) and 1,536 MB in 128 MB increments. |
| timeout         | Optional             |      3S       | The duration a function allowed to execute. Choose a value between 1 and 300 seconds; The default is 3 seconds. |
| exclude         | Optional             |             | exclude file |
| include         | Optional             |             | include file |
| [environment](#environment-param-description) | Optional             |             | Function configure |
| [vpcConfig](#vpcConfig-param-description)| Optional            |             | API-Gateway configure |


### environment param description

| Param        |   Description |
| --------     |   :----      |
| variables    |   Environment variable array |


### vpcConfig param description

| Param        |  Description |
| --------     |   :----      |
| subnetId     |  ID of the VPC |
| vpcId        | ID of the subnet |

