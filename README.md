# npm_cache_share
## 介绍
该工程是用于发布时安装模块依赖的，强制依赖npm-shrinkwrap.json文件，如果工程没有该文件，请执行npm shrinkwrap来生成（否则走正常的npm install）。工程主要是以模块为缓存单元来进行安装的，有的缓存的做法是将整个工程的node_modules来生成缓存，只要有新增的模块就要生成新的，在空间和时间上都不是最细粒度的。该方案涉及两个阶段缓存，第一阶段是本地缓存，第二阶段是公共缓存(存在于其他机器上，需要在该机器上启动缓存服务)。

## 产生背景
为了避免将node_modules入到工程版本库里(这种方式对于有环境依赖的模块是有问题的，比如node-sass,fibers等必须重新build才能运行)，需要在发布过程中动态安装，虽然npm自身也有cache,但即使开启了(通过 *--cache-min 时间* 来开启)还是会发起请求询问是否更新，当然这个不是主要问题，主要还是依赖node-gyp的模块，有的编译时间耗费较长，故为了解决这些问题而产生该项目。可以通过docker来模拟目标机器的环境来执行编译操作。

## 缓存服务搭建工作

#### client端

1. 安装node.js环境，可以上官网自行安装，版本 ≥0.12
2. 安装npm_cache_share，`npm install -g npm_cache_share`
3. 根据场景执行 `ncs install [options]`，可参见 [指令](#command)

#### 中央公共服务

1. 安装node.js环境，可以上官网自行安装，版本 ≥0.12
2. 安装npm_cache_share，`npm install -g npm_cache_share`
3. 启动服务 `ncs server [options]`, 可参见 [中央公共服务](./docs/server.md)

## 文档
- [中央公共服务](./docs/server.md)
- [前后端关联](./docs/linkFront2Backend.md)
- [包发布与安装](./docs/modules.md)
- [架构](./docs/architecture.md)

## 工程命名
在pacakage.json中针对name的格式进行约束，只有满足了该格式才允许继续，可参见[工程命名](./docs/projecName.md)，注意需要符合npm的命名要求

## SNAPSHOT和RELEASE
区分SNAPSHOT和RELEASE版本，根据文件名来自动识别是NAPSHOT，还是RELEASE，可参加[SNAPSHOT和RELEASE](./docs/version.md)

## [配置信息](./docs/config.md)

## 注意
> 针对optionalDependecise里的包，明确知道系统环境不符合，可以在配置文件中配置npmPlatBinds来过滤这些模块。
> 例子：安装fsevents包，需要OS是darwin，但当前环境是linux，此时可以设置 npmPlatBinds = {"fsevents": 1}
> 如果存在依赖的模块需要额外执行安装后操作，或者有需要强制更新指定模块的，请挪驾[中央公共服务](./docs/server.md)查看
> 如果遇到域名解析失败，getaddrinfo这种的，可以在服务端配置storageConfig的host时直接使用IP
> Mac系统的用户需要注意下，node版本最低要大于等于4，因为fibers对Xcode有要求。如果非要使用，可查阅[fibers issues](https://github.com/nodejs/node-gyp/issues/1160)里的方式解决
> 由于历史迭代版本，yarn安装会产生莫名错误，可以考虑清空本地缓存，对于运行效率首次会受影响，后续正常
> 在centos6系统下node8以上版本gyp编译的时候会失败，可以看看本地gcc的版本，默认是4.4.7,需要升级到4.7版本以上才行，升级gcc要万分小心

<h1 id="command">指令</h1>

```
Usage:  <commands> [options]

Commands:

    server              将会启动公共缓存服务，一般用做多台机器共享缓存模块，会在指令执行路径下生成npm_cache_share文件夹来存放缓存                    
    install             进行依赖安装，会依赖npm-shrinkwrap.json文件来安装模块（如果不存在则使用npm install）
    clean               清除缓存，需要指定是客户端，还是服务端，默认是清除客户端缓存目录
    config              配置选项默认值，可set，get，list大部分option，也可以通过~/.npm_cache_share_config.json手动修改这些配置，会影响所有指令
    publish             发布一个包到中央缓存
    upload              上传一个静态资源到swift仓库
    download            从swift仓库下载一个静态资源
    swift               swift仓库操作，目前支持查询对象是否存在，删除对象功能。
    help                帮助说明

Options:
	-V,--version       打印当前版本信息
	-d,--debug         打印所有调试信息
	-h,--help          显示该条命令的帮助信息
    -g,--config        读取指定的配置文件

  of 'server'
    -s,--storage        指定中央缓存类型，目前有localfile和swift
    -c --storageConfig  指定中央缓存配置，localfile为"[存储目录路径]"，swift为"[HOST\|USER\|TOKEN]"
    -p,--port           指定公共缓存服务的端口，使用如 npm_cache_share server --port 9999
    -f,--useFork        强制使用fork方式启动（如果检测到本地pm2会自动使用pm2启动服务）
    -t,--token          指定服务的令牌token，用于校验用户上传权限
    -i,--i              适用于pm2启动服务，指定进程数目
    -n,--name           适用于pm2启动服务，指定服务名称

  of 'install'
    -e,--repository     指定公共缓存服务仓库，由HOST:PORT/NAME构成
    -r,--registry       指定安装的源, 使用如 npm_cache_share install --registry 源
    -t,--token          仅type=node，指定公共服务上传所需要校验的token
    -a,--auth           仅type=nexus，指定nexus账户（username:password）
    -n,--npm [npm]      可指定npm的安装路径来执行npm指令，用于指定特定版本的npm
    -p,--production,--noOptional,--save,--save-dev	同npm安装
    --checkSnapshotDeps 安装时检查依赖中是否存在SNAPSHOT版本的模块

  of 'clean'
     -s,--forServer     指定当前运行环境是在公共缓存服务上，使用如 npm_cache_share clean --forServer

  of 'publish'
     -c,--type          指定公共缓存服务类型，目前有node（默认）与npm（需要提前npm login）
     -e,--repository    指定公共缓存服务仓库，由HOST:PORT/NAME构成
     -t,--token         仅type=node，指定公共服务上传所需要校验的token
     -p,--password      每个包上传时可以设置一个密码，覆盖该包时必须使用该密码
     -s, --snapshot     作为快照版本上传，发布始终覆盖，安装始终更新，忽略本地缓存
     -u, --alwaysUpdate 覆盖服务器上同名版本（在单机服务的情况下安装会始终更新，忽略本地缓存），version内容不变
     -o, --override     如果指定-s参数，则会将新的version更新文件信息，默认不更新  
     --checkSnapshotDeps  发布时检查依赖中是否存在SNAPSHOT版本的模块  

   of 'upload','download','qupload','qdownload'
     -h, --host         swift仓库的地址
     -u, --user         swift仓库的账户        
     -w, --pass         swift仓库的密码
     -c, --container    需要上传／下载的目标容器
     -f, --forceUpdate  该参数只有qupload和upload使用，会覆盖服务器上同名版本
     -a, --auto         该参数只有qupload和qdownload使用，为true则通过package.json里的信息来指定container，否则就通过container参数或者全局配置文件里resourceSwift来指定
     -z, --compressType 指定压缩方式，zip或者tar，默认为tar

   of 'swift'           提供简单的swift操作，目前支持query和delete
     -h, --host         swift仓库的地址
     -u, --user         swift仓库的账户        
     -w, --pass         swift仓库的密码
     -c, --container    需要上传／下载的目标容器
```
## 涉及第三方存储
[Swift](./docs/swift.md)

## 历史版本
[历史版本](./docs/history.md)
