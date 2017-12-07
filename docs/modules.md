# 包发布与使用

# 发布
通过ncs publish会将当前工程进行打包，上传至中央服务，中央服务再存储至仓库，当前仓库支持swift和localfile，推荐使用swift，不会和npm源进行同步，所以这些包只能通过ncs来进行安装。

此指令一般针对包工程，在工程根目录下执行该命令，会将该工程打包，并通过中央服务上传至仓库。推荐在发布前执行npm shrinkwrap固化版本，我们会按照npm-shrinkwrap.json文件描述在该包下安装依赖包。

# 文件忽略
可以在.ignore或者.gitignore里指定需要忽略的目录和文件。

# SNAPSHOT
在package.json里version属性里含有 **SNAPSHOT** 字样的都将被作为快照版本对待，可在配置文件里配置分隔符（SNAPSHOTLINKE属性），默认为-。行为描述如下：
- 发布：始终会覆盖同名模块
- 安装：始终会从服务器端更新，忽略本地缓存
注意：包发布是通过公共缓存服务来上传的，所以SNAPSHOT和RELEASE的配置由服务端来决定，请参见[公共服务](./server.md)

# 安装
在初次新增依赖时，通过ncs install (包名称)[@包版本]；或者在相关依赖固化之后，直接使用ncs install，都会优先安装通过ncs publish发布到仓库的包。如果未找到，才会尝试从npm源安装。

# 指令
- publish 发布包, 公共服务需要启动，参见[公共服务](./server.md)。

>Usage: publish|p [options]
>
>  Publish a dir as a package to center cache server
>
>  Options:
>
>-    -c, --type [type]              server type node/npm, default is node
>-    -e, --repository [repository]  specify the repository, format as HOST:PORT/REPOSITORY-NAME
>-    -t, --token [token]            use the token to access the npm_cache_share server
>-    -p, --password [password]      use the password to access certain package
>-    -r, --registry [registry]      specify the npm registry
>-    -s, --snapshot                 specify this is a snapshot version
>-    -v, --moduleVersion [moduleVersion]   specify the module version
>-    -u, --alwaysUpdate             this module will publish overwrite the same version on the server, and will always update when install, if -s not specify, the version remain unchanged"],
>-    -o, --overwrite                if -s exist, it will overwrite the version into package.json"
>-    --checkSnapshotDeps            check if or not dependend on the snapshot module, default is ignore check


# 参数额外说明
- repository参数包含两部分，一部分是服务域名和端口，另一部分是repository name，对于swift就是container，对于localfile就是文件名
- token参数是中央公共服务的权限认证，简单的值比较
- dependOnEnv参数指明该包是否需要node-gyp编译，如果是的话，包名的组成会和环境相关
- cancelAlwaysSync参数会忽略本地缓存，始终从中央公共服务获取

# 注意
作为同名包我们会以npm_cache_share中的为主，没有才会从npm源上进行安装。
