# 前后端关联
在现有的团队协作模式中，前后端工程一般都会分开管理，便于不同开发角色开发和维护，由于游览器有缓存机制，所以会通过版本来控制更新，也就会涉及到前端生成的版本号如何和后端进行关联（当然可以不仅限于版本信息），这里通过npm_cache_share的公共服务的存储能力来存储( ** 目前只支持swift存储 ** )。

# 指令
- qupload 根据配置信息进行压缩上传，区别于upload指令（只做上传操作）
- qdownload 根据配置信息进行下载，区别于download指令（只做下载操作）

# 实现
读取工程根目录下package.json文件，并根据配置进行资源压缩上传，文件名为 ** project + version **， 后端可通过此文件名来获取资源。

## for frontend

> in package.json
>
> f2b
>
>   project：项目名称
>
>   version：版本号
>
>   path：相对于工程目录的待上传目录

```json
example package.json
{
  	...
 	"f2b": {
  		"project": "sample_project",
  		"version": "btag-1234567",
  		"path": "./ver"
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

```json
{
	...
  	"f2b": {
        "sample_project": {
            "version": "btag-1234567",
            "path": "./static/"
        },
        "another_sample_project": {
            "version": "btag-1234567",
            "path": "./"
        }
	}
}
```
