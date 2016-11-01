##npm_cache_share
##介绍
该工程是用于发布时安装模块依赖的，强制依赖npm-shrinkwrap.json文件，如果工程没有该文件，请执行npm shrinkwrap来生成。该工程主要是以模块为单位来进行安装的，有的缓存的做法是将整个工程的node_modules来生成缓存，只要有新增的模块就要生成新的，在空间和时间上都不是最细粒度的。本工程分两级缓存，一级是本机器缓存，第二级是公共缓存机器(需要启动缓存服务)。

##问题
为了避免将node_modules入到工程版本库里(这种方式对于有环境依赖的模块是有问题的，比如node-sass,fibers等必须重新build才能运行)，需要在发布过程中动态安装，虽然npm自身也有cache,但即使开启了(通过 *--cache-min 时间* 来开启)还是会发起请求询问是否更新，当然这个不是主要问题，主要还是依赖node-gyp的模块，有的编译时间耗费较长，故为了解决这些问题而产生该项目。
##指令
```
Usage:  <commands> [options]

Commands:

    server      将会启动公共缓存服务，一般用做多台机器共享缓存模块，会在指令执行路径下生成npm_cache_share文件夹来存放缓存                    
    install     进行依赖安装，会依赖npm-shrinkwrap.json文件来安装模块（如果不存在则直接通过npm install）
    clean       清除缓存，需要指定是客户端，还是服务端，默认是清除客户端缓存目录
    config		配置选项默认值，可set，get，list大部分option，也可以通过~/.npm_cache_share_config.json手动修改这些配置
    help        帮助说明

Options:
	-V,--version	打印当前版本信息
	-d,--debug		打印所有调试信息
	-h,--help		显示该条命令的帮助信息

  of 'server'
  	-s,--storage		指定中央缓存类型，目前有localfile和swift
    -c --storageConfig 	指定中央缓存配置，localfile为"[存储目录路径]"，swift为"[HOST\|USER\|TOKEN]"
    -p,--port        	指定公共缓存服务的端口，使用如 npm_cache_share server --port 9999
    -f,--useFork		强制使用fork方式启动（如果检测到本地pm2会自动使用pm2启动服务）
    -t,--token			指定服务的令牌token，用于校验用户上传权限
    -i,--i				适用于pm2启动服务，指定进程数目
    -n,--name			适用于pm2启动服务，指定服务名称

  of 'install'
  	-c,--type			指定公共缓存服务类型，目前有node（默认）与nexus（功能有限）
  	-e,--repository     指定公共缓存服务仓库，由HOST:PORT/NAME构成
    -r,--registry    	指定安装的源, 使用如 npm_cache_share install --registry 源
    -t,--token			仅type=node，指定公共服务上传所需要校验的token
    -a,--auth			仅type=nexus，指定nexus账户（username:password）
    -p,--production,--noOptional,--save,--save-dev	同npm安装

  of 'clean'
     -s,--forServer   指定当前运行环境是在公共缓存服务上，使用如 npm_cache_share clean --forServer

```
