#!/bin/bash

set -e

# 注入配置参数
source ./.env

# 构建的类型，默认构建个人版，可以指定为 enterprise 来构建企业版
# 比如： ./build.sh enterprise
type=$1

# 镜像构件函数
build() {
  server_url=$1
  image_url=$1/$2/$3
  # 1. 登录，需要输入登录密钥
  docker login "$server_url" --username=$UIN --password "$password"
  # 2. 构建
  echo "正在构件镜像..."
  docker build -t "$image_url:$tag_name" .
  # 3. 推送
  echo "正在同步镜像..."
  docker push "$image_url:$tag_name"
}

#####################
# 构建个人版镜像
#####################
buildPersonal() {
  # 镜像服务域名
  server_url="ccr.ccs.tencentyun.com"

  # 开始构件
  build $server_url $namespace $image_name
}
#####################
# end
#####################

#####################
# 构建企业版镜像
#####################
buildEnterprise() {
  # 镜像服务域名
  server_url="$registry_name.tencentcloudcr.com"

  # 开始构件
  build $server_url $namespace $image_name
}
#####################
# end
#####################


if [[ "$type" != "" ]] && [[ "$type" == "enterprise" ]]
then
  echo "正在构建企业版镜像..."
  buildEnterprise
else
  echo "正在构建个人版镜像..."
  buildPersonal
fi
