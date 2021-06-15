# 腾讯云自定义镜像实例

在部署前，需要先构建镜像，并推送到云端镜像仓库。

首先，复制 `account.example.conf` 为 `account.conf`，并修改其中配置为开发者账号：

```bash
# 主账号 UIN
UIN=123455555

# 实例名称，企业版需要
registry_name="serverless"

# 命名空间
namespace="sls-scf"
# 镜像名称
image_name="nodejs_test_event"
# 镜像版本
tag_name="latest"

# 镜像登录密码
password="xxx"
```

然后，构建镜像：

```bash
# 构建个人版
$ ./build.sh
```

或者构建企业版：

```bash
$ ./build.sh enterprise
```

然后执行 Serverless 部署：

```
$ sls deploy
```
