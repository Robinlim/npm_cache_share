# 代码结构

使用node-annotation，由bin/client为入口解析全部注解启动。

src/js下的代码结构及功能如下：

    ├── annotation	自定义注解
    │   ├── Command.js	命令注解，所有命令被此注解注册
    │   ├── Factory.js	注册registry的工厂模式注解
    │   └── Flow		流程注解，用于代码中的流程控制（类似async库里的流程函数）
    ├── app		中央缓存服务（对应registry中的node类型）
    │   ├── app.js	server服务app
    │   ├── code	server代码
    │   │   ├── annotation	自定义注解
    │   │   │   └── Factory.js	注册storage的工厂模式注解	
    │   │   ├── controller	接口控制器
    │   │   │   ├── index.js	包含上传、下载、依赖版本check等接口
    │   │   │   └── manage.js	包含列出包与相关管理接口
    │   │   ├── dao		
    │   │   │   └── packageList.js
    │   │   └── storage		包存储适配器
    │   │       ├── cache.js	缓存所有仓库和包的索引信息
    │   │       ├── index.js	入口
    │   │       ├── localfile.js	对接本地文件系统的包存储
    │   │       └── swift.js		对接swift的包存储
    │   ├── index.js	server启动入口
    │   ├── public		包管理界面浏览器代码（html、js、css）
    │   └── widget		
    ├── command		客户端命令
    │   ├── clean.js
    │   ├── config.js
    │   ├── download.js
    │   ├── install.js
    │   ├── publish.js
    │   ├── server.js
    │   └── upload.js
    ├── common		公共模块
    │   ├── checkUtils.js		检查npm-srhinkwrap.json与package.json一致性工具
    │   ├── console.js			打印着色工具
    │   ├── constant.js			公共常量
    │   ├── installUtils.js		安装过程工具
    │   ├── manifestUtils.js	解析资源（npm-shrinkwrap.json等）工具
    │   ├── npmUtils.js			执行npm命令工具
    │   ├── shellUtils.js		执行shell命令工具
    │   └── utils.js			
    ├── lib		外部依赖
    │   └── swiftClient		修改过的swift客户端
    └── registry	客户端对应的服务端接口
        ├── nexus.js	对接nexus服务端（已废弃）
        └── node.js		对接nodejs服务端
# 调试说明

- -d选项可以打印更加详细的过程信息，可以看到命令执行过程中的更多细节。
- 配置文件会以json存储到~/.npm_cache_share_config.json，你可以查看该文件获得配置内容。
- 本地缓存（默认存储到~/.npm_cache_share目录下）中会按照“包名称+版本号+可能出现的环境量（node版本、系统类型等）”的文件夹命名存储每个依赖包，可以直接进去看到每个包的具体内容。



# 技术细节

- 上传下载中多次采用流处理（即将文件读取流、打包流和上传流串联在一起）来提升效率，依赖了一些流式包fstream和request等。
- 采用了Factory注解做了一些封装，可以理解为对外统一的interface，对内实现各种对接的adapter，从功能上抽象出了一个实体。
- 在命令解析上做了一些trick，将config配置内的内容在命令解析时直接混入了命令的附加选项上（即默认附加选项是配置文件里面的配置）。所以要求所有命令不能有冲突（相同全名）的附加选项。