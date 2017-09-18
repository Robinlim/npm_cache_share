/**
* @Author: robin
* @Date:   2017-05-08 10:37
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/



var _ = require('lodash'),
    Cache = require('./cache'),
    zkClient = require('../../../common/zkClient'),
    utils = require('../../../common/utils'),
    slide = require("slide"),
    asyncMap = slide.asyncMap,
    NODE_STEP = {
        ROOT: 0,
        USER: 1,
        CONTAINER: 2,
        OBJECT: 3
    };

/**
 * 缓存所有仓库和包的索引信息
 * zookeeper中路径规则为 /npm_cache_share/{user}/{repository}/{moduleName}  节点信息里含有版本
 * @type {Object}
 */
function ZkCache(opts){
    //内部缓存
    this._cache = new Cache();
    //zookeeper客户端
    zkClient.init(opts.zookeeper);
    //用户
    this._user = getUser(opts.storageConfig);
    if(!this._user){
        throw new Error("请配置swift用户信息");
    }
    this._snapshotUser = getUser(opts.storageSnapshotConfig);
}

ZkCache.prototype = {
    /**
     * 缓存就绪后执行
     * @return {Promise}
     */
    ready: function(){
        var cache = this._cache,
            self = this;
        return new Promise(function(resolve, reject){
            //连接zookeeper
            zkClient.connect().then(function(){
                init(self._user, false).then(function(){
                    if(self._user != self._snapshotUser){
                        init(self._snapshotUser, true).then(function(){
                            resolve();
                        });
                    }else{
                        resolve();
                    }
                });
            });
        });

        function init(user, isSnapshot) {
            return new Promise(function(resolve, reject){
                zkClient.exist(user).then(function(isExist){
                    if(isExist){
                        //监听用户节点
                        monitorNode.call(self, isSnapshot, user, cache, function(isSnapshot, path, cache){
                            //监听容器节点
                            return monitorNode.call(self, isSnapshot, path, cache, null, NODE_STEP.CONTAINER);
                        }, NODE_STEP.USER).then(function(){
                            resolve();
                        });
                        return;
                    }
                    zkClient.mkdirp(user).then(function(){
                        //监听用户节点
                        monitorNode.call(self, isSnapshot, user, cache, function(isSnapshot, path, cache){
                            //监听容器节点
                            monitorNode.call(self, isSnapshot, path, cache, null, NODE_STEP.CONTAINER);
                        }, NODE_STEP.USER).then(function(){
                            resolve();
                        });
                    });
                });
            });
        }
    },
    /**
     * 同步swift，删除zookeeper上多余的节点，当swift和zookeeper不一致时
     * @param {Boolean} isSnapshot 是否是snapshot
     * @return {void}
     */
    prune: function(isSnapshot) {
        var self = this,
            cache = this._cache,
            storage = cache.getStorage(),
            isMV = utils.isModuleVersion,
            moduleName, remoteRepos, p;
        return new Promise(function(resolve, reject){
            //获取所有容器
            storage.listRepository(isSnapshot, function(err, list){
                if(err){
                    console.error(err);
                    return;
                }
                remoteRepos = {};
                //遍历远程所有容器
                _.forEach(list, function(el){
                    remoteRepos[el.name] = 1;
                });

                //遍历zookeeper的容器
                p = generatePath.call(self, isSnapshot);
                zkClient.getChildren(p).then(function(repositories){
                    asyncMap(repositories, function(repository, cb){
                        //如果存在，则匹配各模块
                        if(remoteRepos[repository]){
                            console.info('同步swift上' + repository + '容器内容至zookeeper上');
                            //swift存储只有用户、容器、对象三级，故pcks是对象级别，也就是具体版本模块
                            //zookeeper是用户、容器、模块三级，模块节点数据为该模块所有版本信息
                            storage.listPackages(isSnapshot, repository, function(e, pcks){
                                if(e){
                                    console.error(err);
                                    cb(err);
                                    return;
                                }
                                var tmp = {};
                                //遍历所有模块，得到每个模块对应的版本列表，tmp为{moduleName: "moduleVersion@1, moduleVersion@2"}
                                _.forEach(pcks, function(pl){
                                    if(isMV(pl.name)){
                                        moduleName = utils.splitModuleName(pl.name);
                                        tmp[moduleName] = tmp[moduleName] ? [tmp[moduleName], pl.name].join(',') : pl.name;
                                    }else{
                                        tmp[pl.name] = 1;
                                    }
                                });
                                //获取所有的对象
                                p = generatePath.call(self, isSnapshot, repository);
                                zkClient.getChildren(p).then(function(children){
                                    //删除多余版本
                                    asyncMap(children, function(name, cb){
                                        if(tmp[name]){
                                            if(isMV(name)){
                                                p = generatePath.call(self, isSnapshot, repository, name);
                                                zkClient.setData(p, tmp[name]).then(function(){
                                                    tmp[name] = null;
                                                    delete tmp[name];
                                                    cb();
                                                });
                                            }else{
                                                tmp[name] = null;
                                                delete tmp[name];
                                                cb();
                                            }
                                        }else{
                                            console.debug('删除容器' + repository + '下模块:' + name);
                                            self.delModule(isSnapshot, repository, name);
                                            cb();
                                        }
                                    }, function(){
                                        //新增tmp里剩余模块
                                        _.forEach(tmp, function(v, k){
                                            if(isMV(k)){
                                                console.debug('新增容器' + repository + '下模块版本' + v);
                                                _.forEach(v.split(','), function(m){
                                                    m && self.addPackage(isSnapshot, repository, m);
                                                });
                                            }else{
                                                console.debug('新增容器' + repository + '下模块' + k);
                                                self.addPackage(isSnapshot, repository, k);
                                            }
                                        });
                                        remoteRepos[repository] = null;
                                        delete remoteRepos[repository];
                                        cb();
                                    });
                                });
                            });
                        }else{
                            //删除不存在的容器
                            console.debug('删除多余容器:' + repository);
                            self.delRepository(isSnapshot, repository);
                            cb();
                        }
                    }, function(err){
                        if(err){
                            reject();
                            return;
                        }
                        //新增tmp里剩余模块
                        _.forEach(remoteRepos, function(v, k){
                            console.info('同步swift上' + k + '容器内容至zookeeper上');
                            self.addRepository(isSnapshot, k);

                            storage.listPackages(isSnapshot, k, function(e, pcks){
                                if(e){
                                    console.error(err);
                                    cb(err);
                                    return;
                                }
                                var tmp = {};
                                //遍历所有模块，得到每个模块对应的版本列表，tmp为{moduleName: "moduleVersion@1, moduleVersion@2"}
                                _.forEach(pcks, function(pl){
                                    console.debug('新增容器' + k + '下模块版本' + pl.name);
                                    self.addPackage(isSnapshot, k, pl.name);
                                });
                            });
                        });
                        resolve();
                    });
                });
            });
        });
    },
    /**
     * RELEASE和SNAPSHOT是一致的
     * @return {void}
     */
    same: function(){
        this._cache.same();
    },
    /**
     * 清空缓存
     * @return {void}
     */
    clear: function(){
        var self = this;
        return new Promise(function(resolve, reject){
            console.info('同步本地缓存');
            self.prune();
        });
    },
    /**
     * 增加仓库
     * @param {Boolean} isSnapshot 是否是snapshot
     * @param {String} name 仓库名称
     * @param {Object} stat 仓库状态
     */
    addRepository: function(isSnapshot, name, stat){
        var cache = this._cache,
            reps = cache.listRepository(isSnapshot);
            
        //判断缓存中是否存在
        if(!reps[name]){
            var path = generatePath.call(this, isSnapshot, name);
            zkClient.exist(path).then(function(isExist){
                if(isExist){
                    cache.addRepository(isSnapshot, name, stat);
                    doAdd();
                    return;
                }
                zkClient.mkdirp(path).then(function(){
                    doAdd();
                });
            });
        }else{
            doAdd();
        }

        function doAdd() {
            //设置容器节点信息
            if(stat){
                zkClient.setData(path, JSON.stringify(stat));
            }
        }
    },
    /**
     * 删除仓库
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} name 仓库名称
     * @return {boolean}     是否删除成功
     */
    delRepository: function(isSnapshot, name) {
        var self = this,
            path = generatePath.call(this, isSnapshot, name), p;
        zkClient.getChildren(path).then(function(children){
            asyncMap(children, function(c, cb){
                p = generatePath.call(self, isSnapshot, name, c);
                console.debug('删除子节点：' + p);
                zkClient.remove(p).then(cb);
            }, function(){
                zkClient.remove(path);
            });
        });
    },
    /**
     * 追加包到仓库
     * @param {Boolean} isSnapshot 是否是snapshot
     * @param {String} repository 仓库名称
     * @param {String} name       包名称，形如“five@0.0.1”
     */
    addPackage: function(isSnapshot, repository, name){
        var isMV = utils.isModuleVersion(name),
            moduleName = isMV ? utils.splitModuleName(name) : name,
            path = generatePath.call(this, isSnapshot, repository, moduleName),
            pcks = this.listPackages(isSnapshot, repository, moduleName);
        if(!pcks){
            //如果不存在，则代表zookeeper不存在该节点
            var cache = this._cache;
            zkClient.exist(path).then(function(isExist){
                if(isExist){
                    //如果为模块版本，则处理版本数据，否则不需要操作节点数据
                    if(isMV){
                        zkClient.getData(path).then(function(data){
                            if(!hasVersion(name, data)){
                                zkClient.setData(path, data ? [data, name].join(',') : name);
                            }else{
                                cache.addPackage(isSnapshot, repository, name);
                            }
                        });
                    }
                    return;
                }
                zkClient.mkdirp(path).then(function(){
                    isMV && zkClient.setData(path, name);
                });
            });
        }else{
            //如果存在，则zookeeper存在该节点，只针对模块版本信息需要对节点数据进行处理
            if(isMV && !hasVersion(name, pcks.join(','))){
                zkClient.setData(path, (pcks.concat(name)).join(','));
            }
        }
    },
    /**
     * 从仓库中删除包
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} repository 仓库名称
     * @param  {String} name       包名称
     * @return {void}
     */
    delPackage: function(isSnapshot, repository, name) {
        var isMV = utils.isModuleVersion(name),
            moduleName = isMV ? utils.splitModuleName(name) : name,
            path = generatePath.call(this, isSnapshot, repository, moduleName),
            pcks = this.listPackages(isSnapshot, repository, moduleName);
        if(!pcks){
            zkClient.exist(path).then(function(isExist){
                if(isExist && isMV){
                    zkClient.getData(path).then(function(data){
                        zkClient.setData(path, deleteVersion(data, name));
                    });
                }
            });
        }else{
            if(isMV){
                zkClient.setData(path, deleteVersion(pcks.join(','), name));
            }else{
                zkClient.remove(path);
            }
        }
    },
    /**
     * 从仓库中删除模块
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} repository 仓库名称
     * @param  {String} moduleName 模块名称
     * @return {void}
     */
    delModule: function(isSnapshot, repository, moduleName) {
        var path = generatePath.call(this, isSnapshot, repository, moduleName);
        zkClient.remove(path);
    },
    /**
     * 返回缓存全部内容
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @return {Object} 缓存对象
     */
    listAll: function(isSnapshot) {
        return this._cache.listAll.apply(this._cache, arguments);
    },
    /**
     * 返回仓库列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @return {Array} 数组每项包含name，stat
     */
    listRepository: function(isSnapshot){
        return this._cache.listRepository.apply(this._cache, arguments);
    },
    /**
     * 返回模块列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {string} repository  仓库名称
     * @return {Array}              数组每项为模块名（不含版本号以及环境）
     */
    listModules: function(isSnapshot, repository){
        return this._cache.listModules.apply(this._cache, arguments);
    },
    /**
     * 返回模块下的包列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {string} repository  仓库名称
     * @param  {string} name        模块名
     * @return {Array}              数组每项为包名称（含版本号以及环境）
     */
    listPackages: function(isSnapshot, repository, name){
        return this._cache.listPackages.apply(this._cache, arguments);
    },
    /**
     * 比较需要的模块与缓存内容，返回缓存中存在的包名称
     * @param  {string} repository 仓库名称
     * @param  {Array} list        所需的模块列表（包含版本号，不含环境）
     * @param  {Array} userLocals  用户本地缓存 
     * @param  {string} platform   环境信息
     * @return {HashMap}           缓存存在的模块列表（包含版本号和环境）
     */
    diffPackages: function(repository, list, userLocals, platform){
        return this._cache.diffPackages.apply(this._cache, arguments);
    },
    setStorage: function(st){
        this._cache.setStorage(st);
    }
};
module.exports = ZkCache;
/**
 * 获取用户信息
 * @param  {String} config 配置信息
 * @return {String}
 */
function getUser(config){
    return RegExp(/\|([^:]+):[^|]+\|/).exec(config)[1];
}
/**
* 生成节点路径
* @param  {Boolean} isSnapshot 是否是SNAPSHOT版本
* @param  {String}  repository  容器名称
* @param  {String}  moduleName 模块名称
* @return {String}
*/
function generatePath(isSnapshot, repository, moduleName){
    var user = isSnapshot ? this._snapshotUser : this._user;
    if(!repository){
        return user;
    }
    return moduleName ? [user, repository, moduleName].join('/') : [user, repository].join('/');
}
/**
 * 监听节点变更
 * @param  {Boolean} isSnapshot 是否是SNAPSHOT版本
 * @param  {String}  path       节点路径
 * @param  {Cache}  cache       本地内存缓存
 * @param  {Function} callback  获取数据回调
 * @param  {NODE_STEP} nodeStep 节点层级
 * @return {void}
 */
function monitorNode(isSnapshot, path, cache, callback, nodeStep) {
    var childrens, repository;
    return new Promise(function(resolve, reject){
        //获取初始节点数
        zkClient.getChildren(path).then(function(data){
            //获取容器名称
            if(nodeStep == NODE_STEP.CONTAINER){
                repository = path.split('/').pop();
            }
            childrens =  data;
            console.debug('获取' + path + '节点下所有子节点:' + data);

            //监听当前节点下的子节点
            asyncMap(childrens, function(v, cb){
                var p = [path, v].join('/');
                //添加容器节点
                if(nodeStep == NODE_STEP.USER){
                    console.debug('新增' + v + '容器');
                    cache.addRepository(isSnapshot, v);
                }
                if(callback){
                    callback(isSnapshot, p, cache).then(function(){
                            cb();
                    });
                }else{
                    cb();
                }
                //监听数据
                monitorData(isSnapshot, p, cache, repository || v, nodeStep == NODE_STEP.CONTAINER && v);
            }, function(){
                resolve();
            });
        }).then(function(){
            //注册用户节点事件
            zkClient.register(zkClient.Event.NODE_CHILDREN_CHANGED, path, function(data){
                console.debug('触发' + path + '节点监听事件');
                var addChanges = _.difference(data, childrens),
                    rmChanges = _.difference(childrens, data), p;
                if(addChanges.length == 0 && rmChanges.length == 0){
                    console.debug(path + '没有变化');
                    return;
                }
                //新增节点处理
                _.forEach(addChanges, function(v){
                    p = [path, v].join('/');
                    //添加容器节点
                    if(nodeStep == NODE_STEP.USER){
                        console.debug('新增' + v + '容器');
                        cache.addRepository(isSnapshot, v);
                        callback && callback(isSnapshot, p, cache);
                    }
                    //监听数据
                    monitorData(isSnapshot, p, cache, repository || v, nodeStep == NODE_STEP.CONTAINER && v);
                });
                //删除节点处理
                _.forEach(rmChanges, function(v){
                    p = [path, v].join('/');
                    //删除容器节点
                    if(nodeStep == NODE_STEP.USER){
                        console.debug('删除' + v + '容器');
                        //删除子节点监听
                        _.forEach(cache.listModules(isSnapshot, v), function(c){
                            zkClient.unregister(zkClient.Event.NODE_DATA_CHANGED, [p, c].join('/'));
                            zkClient.unregister(zkClient.Event.NODE_CHILDREN_CHANGED, [p, c].join('/'));
                        });
                        cache.delRepository(isSnapshot, v);
                    }else{
                        cache.delModule(isSnapshot, path.split('/').pop(), v);
                    }
                    zkClient.unregister(zkClient.Event.NODE_DATA_CHANGED, p);
                });
                childrens = data;
            });
        });
    });
}
/**
 * 监听节点数据变更
 * @param  {Boolean} isSnapshot 是否是SNAPSHOT版本
 * @param  {String}  path       节点路径
 * @param  {Cache}  cache       本地内存缓存
 * @param  {String}  repository 容器名
 * @param  {Boolean} mv         模块名，如果是user，则为false
 * @return {void}
 */
function monitorData(isSnapshot, path, cache, repository, mv) {
    var oriData;
    //记录原始节点数据
    zkClient.getData(path).then(function(data){
        if(mv){
            //叶子节点的数据是以逗号分割的版本，叶子节点=模块
            console.debug('获取' + path + '节点信息:' + data);
            if(data){
                data = data.split(',');
                //新增模块版本
                _.forEach(data, function(v){
                    console.debug('新增' + repository + '容器中对象:' + v);
                    cache.addPackage(isSnapshot, repository, v);
                });
            }else{
                cache.addPackage(isSnapshot, repository, mv);
            }
        }else{
            cache.addRepository(isSnapshot, repository, dataDeal(data));
        }
        oriData = data;
    }).then(function(){
        //监听节点数据变更
        zkClient.register(zkClient.Event.NODE_DATA_CHANGED, path, function(data) {
            if(mv){
                data = data.split(',');
                //看数据是否发生变更
                //叶子节点的数据是以逗分割的版本，叶子节点=模块
                var addVersions = _.difference(data, oriData),
                    rmVersions = _.difference(oriData, data);
                if(addVersions.length == 0 && rmVersions.length == 0){
                    return;
                }
                //新增模块版本
                _.forEach(addVersions, function(v){
                    if(!v) return;
                    console.debug('新增' + path + '节点信息:' + v);
                    cache.addPackage(isSnapshot, repository, v);
                });
                //删除模块版本
                _.forEach(rmVersions, function(v){
                    if(!v) return;
                    console.debug('删除' + path + '节点信息:' + v);
                    cache.delPackage(isSnapshot, repository, v);
                });
            }else{
                //更新节点信息
                cache.addRepository(isSnapshot, repository, dataDeal(data));
            }
            oriData = data;
        });
    });
}
/**
 * 判断版本是否存在
 * @param  {String} ver  需要判断的版本
 * @param  {String} vers 所有版本
 * @return {String}
 */
function hasVersion(ver, vers){
    return RegExp('(?=[^,])' + ver + '(?=(,|$)),?').test(vers);
}
/**
 * 删除对应版本
 * @param  {String} name  所有版本信息
 * @param  {String} match 待删除版本
 * @return {String}
 */
function deleteVersion(versions, version) {
    versions = versions.replace(RegExp('(?=[^,]' + version + '(?=(,|$)),?'), '');
    if(_.endsWith(versions, ',')){
        versions = versions.substr(0, versions.length -1);
    }
    return versions;
}
/**
 * 数据处理，如果是json格式就转成json对象
 * @param  {Object} data
 * @return {Object}
 */
function dataDeal(data){
    if(RegExp('^{[^}]+}$').test(data)){
        return JSON.parse(data);
    }
    return data;
}
