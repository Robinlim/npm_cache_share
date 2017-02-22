# QzzConfig

通过配置在package.json中的信息完成前端资源（版本信息、模版等）上传，后端下载使用的前后端关联过程。

## for frontend



> in package.json
>
> project：项目名称
>
> version：版本号
>
> path：相对于工程目录的待上传目录

```json
{
  	...
 	"qzzConfig": {
  		"project": "sample_project",
  		"version": "btag-1234567",
  		"path": "./ver"
	}
}

```



## for backend 

> in package.json
>
> qzzConfig的每一项key值是需要的前端工程项目名称（project）
>
> version：前端版本号
>
> path：下载的前端资源需要存放的位置

```json
{
	...
  	"qzzConfig": {
  		 "sample_project": {
  			"version": "btag-1234567",
  			"path": "./ver"
		},
		"another_sample_project": {
  			"version": "btag-1234567",
  			"path": "./"
		}
	}
}
```