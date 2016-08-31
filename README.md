
##npm_cache_share
##介绍
该工程是用于发布时安装模块依赖的，强制依赖npm-shrinkwrap.json文件，如果工程没有该文件，请执行npm shrinkwrap来生成。该工程主要是以模块为单位来进行安装的，有的缓存的做法是将整个工程的node_modules来生成缓存，只要有新增的模块就要生成新的，在空间和时间上都不是最细粒度的。本工程分两级缓存，一级是本机器缓存，第二级是公共缓存机器(需要启动缓存服务)。
##环境
不支持window,只支持类linux系列的系统。
##问题
为了避免将node_modules入到库了(对于有环境依赖的模块是有问题的，比如node-sass,fibers等)，需要在发布过程中动态安装，虽然npm自身也有cache,但即使开启了(通过 *--cache-min 时间* 来开启)还是会发起请求询问是否更新，当然这个不是主要问题，主要还是依赖node-gyp的模块，有的编译时间耗费较长，故为了解决这些问题而产生该工程。

##指令
```
    Usage: npm_cache_share <command> [options]

    Commands:

        server      将会启动公共缓存服务，一般用做多台机器共享缓存模块，会在指令执行路径下生成npm_cache_share文件夹来存放缓存                    
        install     会依赖npm-shrinkwrap.json文件来安装模块，可以指定registry
        clean       清除缓存，需要指定是客户端，还是服务端，默认是清除客户端缓存目录
        help        帮助说明

    Options:
        service     指定公共缓存服务, 使用如 npm_cache_share install --service IP:Port
        registry    指定安装的源, 使用如 npm_cache_share install --registry 源
        production  安装时忽略devDependencies, 使用如 npm_cache_share install --production
        noOptional  安装时忽略optional dependencies, 使用如 npm_cache_share install --noOptional
        port        指定公共缓存服务的端口，使用如 npm_cache_share server --port 9999
        forServer   指定当前运行环境是在公共缓存服务上，使用如 npm_cache_share clean --forServer

```
