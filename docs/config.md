# 配置文件

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
}

```
