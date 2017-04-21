# SNAPSHOT和RELEASE
## 背景
不同环境场景下是否要更新包（模块）的要求不一样，像开发环境下，模块的频繁修改发布是存在的，如果仅仅是通过改变版本号来控制更新就显得非常繁琐，故有

- SNAPSHOT版本，始终获取当前版本下最新的SNAPSHOT版本，格式为 ** module + version + 分隔符 + SNAPSHOT ** ，上传和发布操作都将覆盖同名版本，下载和安装操作都将始终从服务器更新
- RELEASE版本，顾名思义就是正式发布的版本，只能通过变更版本号才会更新，格式为 ** module + version ** ，也可通过指令中的参数来强制更新服务器上的当前版本，具体参见具体使用指令

## 配置

- 分隔符：可以在配置文件里配置 SNAPSHOTLINKE 来指定，默认为-，仅在 publish 指令中生效

## 配置
目前涉及SNAPSHOT和RELEASE的共有两组参数：

- storageSnapshotConfig和storageConfig，该组参数server指令里会使用，install和publish指令会受影响，主要是模块发布和安装时会受影响
- resourceSnapshotSwift和resourceSwift，该组参数upload、download、qupload、qdownload里会使用，主要影响静态资源的上传和下载
