# 包发布与使用

# 发布
通过ncs publish会将当前工程进行打包，上传至中央服务，中央服务再存储至仓库，当前仓库支持swift和localfile，推荐使用swift，不会和npm源进行同步，所以这些包只能通过ncs来进行安装。

此指令一般针对包工程，在工程根目录下执行该命令，会将该工程打包，并通过中央服务上传至仓库。推荐在发布前执行npm shrinkwrap固化版本，我们会按照npm-shrinkwrap.json文件描述在该包下安装依赖包。

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
>-    -d, --dependOnEnv              whether the package is depend on environment meaning whether this package itself need node-gyp compile
>-    -s, --cancelAlwaysSync         mark this package to be NOT sync on each install action
>-    -r, --registry [registry]      specify the npm registry
