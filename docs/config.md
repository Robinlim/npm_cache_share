# 配置文件
该文件里的配置项会影响指令的默认参数，也可以通过指令执行的时候增加参数来覆盖，所以下面的配置都是可选配置。配置文件会优先保存到环境变量 NPM_CACHE_DIR 所指定的路径（同级目录）下，文件名为 `.npm_cache_share_config.json`，如果没有设置该环境变量，则会保存到用户目录下。

## Client端
```json
{
    "type": "node",
    "repository": "中央缓存服务地址，格式为 host:port/容器名称",
    "token": "中央缓存服务的token，权限使用",
    "registry": "指定npm源，可以为内部源",
    "npmPlatBinds": { "darwin": [ "fsevents" ] },
    "resourceSwift": "指定静态资源上传下载RELEASE版本的swift源，格式为 host|user|pass",
    "resourceSnapshotSwift": "指定静态资源上传下载SNAPSHOT版本的swift源，格式为 host|user|pass",
    "compressType": "指定静态资源的压缩方式",
    "auto": "上传下载使用project或key来做容器名",
    "nameReg": "package.json中name的规则，只有在publish和qupload中有效"
}

```
- npmPlatBinds为在某个环境下才会进行安装的模块
- 需要注意模块发布，swift的配置在Server端设置

## Server端
```json
{
    "port": "指定服务的端口",
    "storage": "swift",
    "storageConfig": "指定模块（组件）RELEASE版本的swift源，格式为 host|user|pass",
    "storageSnapshotConfig": "指定模块（组件）SNAPSHOT版本的swift源，格式为 host|user|pass",
    "zookeeper": "启用zookeeper服务，格式为 host:port"
}

```
