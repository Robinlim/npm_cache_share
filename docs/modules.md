# 包发布与使用

# 发布

通过ncs publish可以用类似npm publish的方式发布一个包，通过中央服务上传至仓库（当前支持swift和localfile，推荐使用swift），且不对npm仓库产生影响，所以只能通过ncs来进行安装。

此指令一般针对包工程，在工程根目录下执行该命令，会将该工程打包，并通过中央服务上传至仓库。推荐在发布前执行npm shrinkwrap固化版本。

# 安装

在初次新增依赖时，通过ncs install (包名称)[@包版本]；或者在相关依赖固化之后，直接使用ncs install，都会优先安装通过ncs publish发布到仓库的包。如果未找到，才会尝试从npm源安装。
