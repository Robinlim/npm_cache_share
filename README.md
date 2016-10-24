##npm_cache_share
##介绍
该工程是用于发布时安装模块依赖的，强制依赖npm-shrinkwrap.json文件，如果工程没有该文件，请执行npm shrinkwrap来生成。该工程主要是以模块为单位来进行安装的，有的缓存的做法是将整个工程的node_modules来生成缓存，只要有新增的模块就要生成新的，在空间和时间上都不是最细粒度的。本工程分两级缓存，一级是本机器缓存，第二级是公共缓存机器(需要启动缓存服务)。
##环境
不支持window,只支持类linux系列和mac的操作系统。
##问题
为了避免将node_modules入到工程版本库里(这种方式对于有环境依赖的模块是有问题的，比如node-sass,fibers等必须重新build才能运行)，需要在发布过程中动态安装，虽然npm自身也有cache,但即使开启了(通过 *--cache-min 时间* 来开启)还是会发起请求询问是否更新，当然这个不是主要问题，主要还是依赖node-gyp的模块，有的编译时间耗费较长，故为了解决这些问题而产生该项目。
##指令
```
Usage:  <commands> [options]

Commands:

    clean|c [options]                          Clear the local npm module cache
    config|f [options] [action] [key] [value]  Set config for npm cache
    install|i [options] [module]               Install the module
    server|s [options] [command] [name]        Start a server to store the npm module cache

Options:

    -h, --help     output usage information
    -V, --version  output the version number

```
指令相关帮助可以通过 `npm_cache_share <commands> -h` 来获得。
