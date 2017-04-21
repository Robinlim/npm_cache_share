# 前后端关联
在现有的团队协作模式中，前后端工程一般都会分开管理，便于不同开发角色开发和维护，由于游览器有缓存机制，所以会通过版本来控制更新，也就会涉及到前端生成的版本号如何和后端进行关联（当然可以不仅限于版本信息），这里通过swift分布式存储来作为存储服务，区别于包发布(publish指令，走公共缓存服务来上传至存储服务)，直接通过client直接上传至swift，不走公共缓存服务，也不走本地缓存。

# SNAPSHOT
如果f2b下的version属性里含有 **SNAPSHOT** 字样的都将被作为快照版本对待，上传始终会覆盖服务器上的。可通过resourceSnapshotSwift变量指定swift信息，格式为 **host|user:user|pass**，同resourceSwift。

# 指令
- qupload 根据配置信息进行压缩上传，区别于upload指令（只做上传操作），swift的配置信息可以通过指令参数指定，也可以在config文件中通过resourceSwift变量指定。
>Usage: qupload|qu [options]
>
>Upload a static source to repository by package.json, you can set the swift setting by parameters or use command 'ncs config set resourceSwift "host|user|pass|container"'
>
>Options:
>
>+  -h, --host [host]            host of swift
>+  -u, --user [user]            user of swift
>+  -p, --pass [pass]            pass of swift
>+  -c, --container [container]  container in swift
>+  -f, --forceUpdate            if exists, module on the server will be overrided
>+  -a, --auto                   create container automatically according to package.json,use project parameter in f2b, it will ignore container parameter in command
** 如果设定了auto参数，会忽略指令的container参数以及resourceSwift中container的配置，会根据package.json里f2b的project属性值来动态创建container **

- qdownload 根据配置信息进行下载，区别于download指令（只做下载操作），swift的配置信息同qupload。
>Usage: qdownload|qu [options]
>
>Download a static source to repository, you can set the swift setting by parameters or use command 'ncs config set resourceSwift "host|user|pass|container"'
>
>Options:
>
>+   -h, --host [host]            host of swift
>+   -u, --user [user]            user of swift
>+   -p, --pass [pass]            pass of swift
>+   -c, --container [container]  container in swift
>+   -a, --auto                   according to package.json,use project parameter in f2b to set the value of container, it will ignore container parameter in command
** 如果设定了auto参数，会忽略指令的container参数以及resourceSwift中container的配置，会将package.json里的f2b下的key值作为container来下载对象，所有上传资源都会进行压缩 **

# 实现
读取工程根目录下package.json文件，并根据配置进行资源压缩上传，文件名为 **project + version**， 后端可通过此文件名来获取资源。

## for frontend

> in package.json
>
> f2b
>
>>   project：项目名称，不存在会取package.json里的name属性
>>   version：版本号
>>   path：相对于工程目录的待上传目录
>>   type: 压缩类型，目前支持zip和tar

```json
example package.json
{
  	...
 	"f2b": {
        "project": "sample_project",
        "version": "btag-1234567",
        "path": "./ver",
        "type": "zip"
	}
    ...
}

```



## for backend

> in package.json
>
> f2b
>
>>   key 需要的前端工程名（会和version拼接）
>>>       version：前端版本号
>>>       path：下载的前端资源需要存放的位置
>>>       type: 压缩类型，目前支持zip和tar


```json
{
	...
  	"f2b": {
        "sample_project": {
            "version": "btag-1234567",
            "path": "./static/",
            "type": "zip"
        },
        "another_sample_project": {
            "version": "btag-1234567",
            "path": "./",
            "type": "tar"
        }
	}
}
```
# 注意
> 压缩文件命名时不要以.properties结尾，会导致目录追踪至顶级。
