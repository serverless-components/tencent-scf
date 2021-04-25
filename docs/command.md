# 支持自定义命令

如果当前项目已经部署成功，所有命令可以省略 `function` 参数。

### invoke

**调用函数**，本地调用云函数，如下：

```bash
$ sls invoke --inputs function=scfdemo event='{"hello":{"msg":"world"}}'
```

### log

**查看日志**，查看近一个小时的函数日志，如下：

```bash
$ sls log --inputs function=scfdemo
```

> 注意：函数默认命名空间为 `default`，如果不是，需要带上 namespace=xxx 参数，来指定函数命名空间。

### metric

**查看监控指标**，如下：

```bash
$ sls metric --inputs function=scfdemo
```

> 注意：函数默认命名空间为 `default`，如果不是，需要带上 namespace=xxx 参数，来指定函数命名空间。

默认查看时间粒度为 `1分钟`，目前支持时间粒度为：1 分钟、5 分钟、1 小时，可以通过 `period` 参数指定，单位为 `秒`，比如：

```bash
# 指定时间粒度为 1分钟
$ sls metric --inputs function=scfdemo period=60
```

默认查看时间范围为 `近 15 分钟`，可以通过制定 `interval` 来指定最近时间段，单位为 `秒`，比如近 1 个小时：

```
$ sls metric --inputs function=scfdemo period=60 interval=3600
```

### publish-ver

**发布版本**，不部署直接给函数 `scfdemo` 发版本：

```plaintext
sls publish-ver --inputs function=scfdemo
```

### create-alias

**创建别名**，给云函数 `scfdemo` 创建别名 `routing-alias`，路由规则为：版本 1 流量为 50%，版本 2 流量为 50%，如下：

```plaintext
sls create-alias --inputs name=routing-alias function=scfdemo version=1 config='{"weights":{"2":0.5}}'
```

### update-alias

**更新别名**，更新云函数 `scfdemo` 别名 `routing-alias` 的流量规则为版本 1 流量为 10%，版本 2 流量为 90%：

```plaintext
sls  --inputs name=routing-alias function=scfdemo  version=1 config='{"weights":{"2":0.9}}'
```

### list-alias

**查看别名**，列举云函数 `scfdemo` 别名 `routing-alias`：

```plaintext
sls list-alias --inputs function=scfdemo
```

### delete-alias

**删除别名**，删除云函数 `scfdemo` 的别名 `routing-alias`：

```plaintext
sls delete-alias --inputs name=routing-alias function=scfdemo
```
