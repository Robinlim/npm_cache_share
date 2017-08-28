var _ = require('lodash'),
    zookeeper = require('node-zookeeper-client'),
    CreateMode = zookeeper.CreateMode,
    Event = zookeeper.Event;

var zk,
    eventCache = {},
    bindsEvent = {},
    ZKROOT = '/npm_cache_share';

module.exports = {
    Event: Event,
    /**
     * 创建zookeeper clinet
     * @param  {String} zkConfig zookeeper的链接，如host:port
     * @return {void}
     */
    init: function(zkConfig) {
        zk = zookeeper.createClient(zkConfig);
    },
    /**
     * 连接zookeeper
     * @return {type} [description]
     */
    connect: function(){
        return new Promise(function(resolve, reject){
            zk.once('connected', function () {
                console.info('Connected to the zookeeper.');
                resolve();
            });
            zk.connect();
        });
    },
    /**
     * 获取节点数据
     * @param  {String} path 路径
     * @return {Promise}
     */
    getData: function(path) {
        var self = this;
        path = generatePath(path);
        return new Promise(function(resolve, reject){
            //由于要监听节点数据变化需要通过该函数第二个参数来指定，每次处理就需要重新监听
            if(bindsEvent[Event.NODE_DATA_CHANGED + path]){
                zk.getData(path, function(error, data, stat){
                    //初次获取节点数据
                    if(error){
                        console.error(error);
                        reject(error);
                        return;
                    }
                    //data为Buffer类型，转换为String
                    resolve((data || "").toString('utf8'));
                });
                return;
            }
            bindsEvent[Event.NODE_DATA_CHANGED + path] = 1;
            zk.getData(path, function (event) {
                watchEvent(event);
            }, function(error, data, stat){
                //初次获取节点数据
                if(error){
                    console.error(error);
                    reject(error);
                    return;
                }
                //data为Buffer类型，转换为String
                resolve((data || "").toString('utf8'));
            });
        });

        /**
         * 事件处理，由于事件被触发后，想要再次监听，需要重新绑定事件
         * @param  {Event} event
         * @return {void}
         */
        function watchEvent(event) {
            //删除对象节点时会触发两次事件
            if(event.name == 'NODE_DELETED'){
                return;
            }
            //节点数据变更处理，由于触发监听后event中获取不到数据，故需要通过getData来获取数据并绑定监听
            zk.getData(path, function(event){
                //递归监听
                watchEvent(event);
            }, function(error, data, stats){
                if(error){
                    console.error(error);
                    return;
                }
                if(event.name == 'NODE_DATA_CHANGED'){
                    //触发事件监听
                    self.trigger(Event[event.name], path, (data || "").toString('utf8'));
                }
            });
        }
    },
    /**
     * 设置节点数据
     * @param  {String} path 路径
     * @param  {String} data 数据
     * @return {Promise}
     */
    setData: function(path, data){
        path = generatePath(path);
        return new Promise(function (resolve, reject) {
            zk.setData(path, Buffer.from(String(data)), function(error, stat){
                if(error){
                    console.error(error);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    },
    /**
     * 判断节点路径是否存在
     * @param  {String} path 节点路径
     * @return {Promise}
     */
    exist: function(path){
        path = generatePath(path);
        return new Promise(function (resolve, reject) {
            zk.exists(path, function(err, stat){
                //错误
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                //存在
                if (stat) {
                    resolve(true);
                    return;
                }
                //不存在
                resolve(false);
            });
        });
    },
    /**
     * 获取子节点
     * @param  {String} path 节点路径
     * @return {Promise}
     */
    getChildren: function(path){
        var self = this;
        path = generatePath(path);
        return new Promise(function (resolve, reject) {
            //由于要监听子节点变化需要通过该函数第二个参数来指定，每次处理就需要重新监听
            if(bindsEvent[Event.NODE_CHILDREN_CHANGED + path]){
                zk.getChildren(path, function(error, children, stats){
                    if(error){
                        console.error(error);
                        reject(error);
                        return;
                    }
                    resolve(children || []);
                });
                return;
            }
            bindsEvent[Event.NODE_CHILDREN_CHANGED + path] = 1;
            zk.getChildren(path, function(event){
                watchEvent(event);
            }, function(error, children, stats){
                if(error){
                    console.error(error);
                    reject(error);
                    return;
                }
                resolve(children || []);
            });
        });

        /**
         * 事件处理，由于事件被触发后，想要再次监听，需要重新绑定事件
         * @param  {Event} event
         * @return {void}
         */
        function watchEvent(event) {
            //删除容器节点时会触发两次事件
            if(event.name == 'NODE_DELETED'){
                return;
            }
            //节点变更处理，由于触发监听后event中获取不到数据，故需要通过getChildren来获取数据并绑定监听
            zk.getChildren(path, function(event){
                //递归监听
                watchEvent(event);
            }, function(error, children, stats){
                if(error){
                    console.error(error);
                    return;
                }
                if(event.name == 'NODE_CHILDREN_CHANGED'){
                    self.trigger(Event[event.name], path, children);
                }
            });
        }
    },
    /**
     * 创建路径，允许是不存在的节点，永久类型节点
     * @param  {String} path 路径
     * @return {Promise}
     */
    mkdirp: function(path) {
        path = generatePath(path);
        return new Promise(function (resolve, reject) {
            zk.mkdirp(path, CreateMode.PERSISTENT, function (error, path) {
                if (error) {
                    console.error(error);
                    reject(error);
                    return;
                }
                resolve(path);
            });
        });
    },
    /**
     * 删除节点
     * @param  {String} path 节点路径
     * @return {Promise}
     */
    remove: function(path){
        path = generatePath(path);
        return new Promise(function (resolve, reject) {
            zk.remove(path, function (error) {
                if (error) {
                    console.error(error);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    },
    /**
     * 触发事件
     * @param  {String} type 事件类型
     * @param  {String} path 节点路径
     * @param  {Object} data 数据
     * @return {void}
     */
    trigger: function(type, path, data){
        if(!eventCache[type] || !eventCache[type][path]){
            return;
        }
        eventCache[type][path](data, type, path);
    },
    /**
     * 监听事件
     * @param  {String} type 事件类型
     * @param  {String} path 节点路径
     * @param  {Function} callback 事件回调
     * @return {void}
     */
    register: function(type, path, callback) {
        path = generatePath(path);
        console.debug('注册' + path + '节点的' + type + '类型监听');
        if(!eventCache[type]){
            eventCache[type] = {};
        }
        eventCache[type][path] = callback;
    },
    /**
     * 注销监听事件
     * @param  {String} type 事件类型
     * @param  {String} path 节点路径
     * @return {void}
     */
    unregister: function(type, path) {
        if(!eventCache[type]){
            return;
        }
        path = generatePath(path);
        console.debug('注销' + path + '节点的' + type + '类型监听');
        eventCache[type][path] = null;
        bindsEvent[type + path] = 0;
        delete bindsEvent[type + path];
    }
}
/**
* 生成节点路径
* @param  {Boolean} isSnapshot 是否是SNAPSHOT版本
* @param  {String}  repository  容器名称
* @param  {String}  moduleName 模块名称
* @return {String}
*/
function generatePath(path){
    return [ZKROOT, path].join('/');
}
