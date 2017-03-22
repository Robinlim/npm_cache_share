# 中央公共服务
在安装模块的时候，一般在本地机器上会存有模块的缓存，但这样缓存信息只能单台机器享有，为了使多台机器共享模块缓存，需要搭建中央公共服务来提供服务，该服务还涉及权限认证，避免普通用户修改影响到公共资源。

# 权限
避免任何人都能修改缓存信息，增加了token校验，如果设置了token参数，在更新的时候会校验请求头里token的值。

# 指令
> Usage: server|s [options] [command] [name]
>
>  Start a server to store the npm module cache, command is for pm2, like start、stop、restart，and so on， name mean the name of application for pm2.
>
>  Options:
>
>-    -s, --storage [storage]              specify the type of storage, could be localfile or swift
>-    -c, --storageConfig [storageConfig]  specify the config of storage, serveral arguments joined with '|', the format of swift is 'host|user|pass', localfile is 'cache path'"
>-    -p, --port [port]                    specify the port of the service, default is 8888
>-    -f, --useFork                        start with fork
>-    -t, --token [token]                  control the auth to access the server
>-    -i, --i [i]                          thread count only for pm2
>-    -n --name [name]                     app name only for pm2

## 注意
- 如果storage选择swift，只能启动单机单进程，由于要记录swift的信息，并维护ncs操作的更新，如果只是做单机级别的多进程共享意义不大，更加提倡多机的方式来部署，会考虑redis或者memcached这样分布式缓存服务。
- pm2的版本2.4.2以上，有些低版本会有问题。
