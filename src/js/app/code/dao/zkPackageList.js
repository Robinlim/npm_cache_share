/**
* @Author: wyw.wang <wyw>
* @Date:   2016-12-07 16:53
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-12-07 16:54
*/

var _ = require('lodash'),
    path = require('path'),
    constant = require('../../../common/constant'),
    zkClient = require('../../../common/zkClient'),
    utils = require('../../../common/utils');

var ROOT = 'private';

function ZkPackageList() {
    this._map = {};
}

ZkPackageList.prototype = {
    /**
     * 加载包配置信息
     * @return {void} [description]
     */
    load: function(){
        var oriData = [],
            _map = this._map;
        //初始化私有模块数据
        zkClient.getChildren(ROOT).then(function(data){
            if(!data || data.length == 0){
                return;
            }
            oriData = data;
            _.forEach(data, function(v){
                //监听节点数据变更
                zkClient.register(zkClient.Event.NODE_DATA_CHANGED, [ROOT, v].join('/'), function(data){
                    if(data){
                        console.debug('设置模块' + v + '的信息');
                        _map[v] = JSON.parse(data);
                    }
                });
                zkClient.getData([ROOT, v].join('/')).then(function(data){
                    if(data){
                        _map[v] = JSON.parse(data);
                    }
                });
            });
        });
        //监控
        zkClient.register(zkClient.Event.NODE_CHILDREN_CHANGED, ROOT, function(data){
            console.debug('触发' + ROOT + '节点监听事件');
            var addChanges = _.difference(data, oriData),
                rmChanges = _.difference(oriData, data);
            //置换成新的缓存
            oriData = data;
            //新增模块处理
            _.forEach(addChanges, function(v){
                if(v){
                    //由于新增节点的同时可能获取数据，故需要马上获取数据
                    zkClient.getData([ROOT, v].join('/')).then(function(data){
                        if(data){
                            console.debug('初始化' + [ROOT, v].join('/') + '节点数据');
                            _map[v] = JSON.parse(data);
                        }
                    });
                    //监听节点数据变更
                    zkClient.register(zkClient.Event.NODE_DATA_CHANGED, [ROOT, v].join('/'), function(data){
                        if(data){
                            console.debug('设置模块' + v + '的信息');
                            _map[v] = JSON.parse(data);
                        }
                    });
                }
            });
            //删除模块处理
            _.forEach(rmChanges, function(v){
                //注销监听
                zkClient.unregister(zkClient.Event.NODE_DATA_CHANGED, [ROOT, v].join('/'));
                //删除节点对应的内存映射
                _map[v] = null;
                delete _map[v];
            });
        });
    },
    /**
     * 列出指定策略的模块
     */
    list: function(){
        return this._map;
    },
    /**
     * 追加一个包的信息
     * @param {string} name     包名称
     * @param {json} info       包信息
     * @param {Function} cbk    回调函数
     */
    add: function(name, info, cbk){
        console.info('[synclist] add:', name, JSON.stringify(info));
        var p = [ROOT, name].join('/');
        zkClient.exist(p).then(function(isExist){
            if(isExist){
                zkClient.setData(p, JSON.stringify(info)).then(function(){
                    cbk();
                });
                return;
            }
            zkClient.mkdirp(p).then(function(){
                zkClient.setData(p, JSON.stringify(info)).then(function(){
                    cbk();
                });
            });
        });
    },
    /**
     * 删除一个包的信息
     * @param {string} name  包名称
     * @param {Function} cbk 回调函数
     */
    remove: function(name, cbk){
        console.info('[synclist] remove:', name);
        var p = [ROOT, name].join('/');
        zkClient.exist(p).then(function(isExist){
            if(isExist){
                zkClient.remove(p).then(function(){
                    cbk();
                });
            }
        });
    },
    /**
     * 比较出需要同步的包
     * @param  {array} list 需要依赖包
     * @return {map}      需要同步的依赖包
     */
    diffSync: function(list){
        var hit = {},
            _map = this._map;
        _.forEach(list, function(el){
            var name = utils.splitModuleName(el),
                moduleStrategy = _map[name];
            //只要含有SNAPSHOT标示就算，由于存在本地会导致多机情况下实效，最低要保证SNAPSHOT版本的更新
            if(moduleStrategy || utils.isSnapshot(el)){
                moduleStrategy[constant.CACHESTRATEGY.ALWAYSUPDATE] = 1;
                hit[el] = moduleStrategy;
            }
        });
        return hit;
    },
    /**
     * 列出指定策略的模块
     */
    list: function(){
        return this._map;
    },
    /**
     * 判断一个包是否是私有模块
     * @param  {string} name 包名称
     * @return {boolean}      [description]
     */
    checkPrivate: function(name){
        return this._map[name] && this._map[name].isPrivate;
    },
    /**
     * 判断对一个私有模块是否有权限
     * @param  {string} name     包名称
     * @param  {string} password 私钥
     * @return {boolean}          [description]
     */
    auth: function(name, password){
        var _map = this._map;
        if(_map[name] && _map[name].isPrivate && _map[name].password){
            return password === _map[name].password;
        } else {
            return true;
        }
    }
}

module.exports = ZkPackageList;
