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
- server和client均可以使用config命令进行永久性配置，用clean命令清除本地缓存（对server来说是localfile的storage）。

## server细节

​	server用ncs server命令启动（分为直接fork和调用PM2启动两种方式），由于采用swift仓库的话需要统一管理目录缓存所以仅能单进程启动。

### storage
​	storage用Factory注解抽象出了一层适配层（/app/code/storage/index.js），定义了有关包操作的一些接口，在具体的每个适配器实现中实现具体接口(/app/code/storage/localfile.js和/app/code/storage/swift.js)。

​	storage存储部分目前实现了两种，localfile是直接使用服务器本地的文件系统存储包，swift使用ops统一维护的swift仓库存储包。

​	由于本地存储的包的下载并发存在瓶颈，并且为了便于分布式部署，目前均采用swift方式存储包。

​	cache部分是一个包的目录缓存，在每次服务启动时会从swift同步一份当前包的列表，在每次有包上传是更新当前列表。这个目录列表用于判断哪些包是中央缓存所存在的，以及判断包的类型（是node-gyp编译包还是无需编译的包）。

### dao

​	dao层在本地用json文件简单的存储了私有包（即由用户手动publish的包）的相关信息，包括包的名称、是否需要每次同步以及包的密钥。

​	发布一个私有包时会配置它是否需要每次同步（即每次安装均从中央缓存下载而不使用本地缓存，主要用于频繁改动而不升级版本的开发阶段以及非功能改动的bug修复）。同时会配置或校验它的密钥（指定包在初次上传时会需要配置密钥，之后的每次覆盖上传需要带上这个密钥，防止无关人员误操作覆盖）。

### controller

​	controller是中央服务队外提供的所有接口api和界面管理地址。

​	index中是服务基础的上传、下载、校验接口。manage中是管理界面（可用查看当前服务缓存的包目录与包信息）。均适用controller和requestMapping注解完成。



## client细节

​	client的功能包括安装（install）、发布包（publish）、上传／下载静态资源（upload/download）。	

### install

​	安装流程是整个工程的核心。分为以下几步:

- 判断参数，不带参数认为是初始化安装，参数为带版本的包名称则直接按之后的安装流程安装该包，参数为不带版本的包名称则先用npm view获取最新版本号进行安装。
- 判断项目当前状态，存在依赖固化文件（npm-shrinkwrap.json或者yarn.lock）则可以取到每个包所需求的版本，进行之后的安装。否则直接调用npm install。
- 安装。至此，所有待安装的包都获取到了待安装的版本号，全称通过请求server端得到（包含包名、版本号、需要node-gyp编译的还有node版本、系统类型等环境量）。
  - 判断是否是需要每次同步的包，如是跳过取本地缓存。如果不是，且本地缓存有则跳过下载、安装。
  - 判断中央服务是否有，有则下载，跳过本地安装。
  - 本地通过npm install 批量安装缺失的包（仅会发生在初次安装中的少量新增包）并上传这些包到中央缓存。
  - 将所有安装／下载完的包按照依赖固化文件的树形结构复制到当前项目目录下。
- 收尾。安装单个包会自动追加入package.json并自动执行npm shrinkwrap重写依赖固化文件。

### publish

​	发布当前目录为一个私有包（类似npm的publish，但是不会上传到任何npm仓库，可以覆盖同名的npm包）。

### upload／download

​	上传／下载一个静态资源。将不会关联到中央缓存服务，直接与一个特定的静态资源swift仓库进行交互。初步用于前端资源版本号文件与前端资源模版文件等需要用于前后端关联的静态资源文件的跨工程关联与发布。