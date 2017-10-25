/**
* @Author: wyw.wang <wyw>
* @Date:   2016-12-07 16:53
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-12-07 16:54
*/

var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    constant = require('../../../common/constant'),
    utils = require('../../../common/utils');

var serverCachePath = utils.getServerCachePath(),
    packageListName = 'packageList.json',
    packageListPath = path.join(serverCachePath, packageListName);

function PackageList(){
    this._map = {};
}

PackageList.prototype = {
    /**
     * 加载包配置信息
     * @return {void} [description]
     */
    load: function(){
        if(fs.existsSync(packageListPath)){
            this._map = fsExtra.readJsonSync(packageListPath);
        }
    },
    /**
     * 列出指定策略的模块
     */
    list: function(){
        return this._map;
    },
    /**
     * 追加一个包的信息
     * @param {string} name 包名称
     * @param {json} info 包信息
     * @param {Function} cbk 回调函数
     */
    add: function(name, info, cbk){
        console.info('[synclist] add:', name, JSON.stringify(info));
        this._map[name] = info;
        this.save();
        cbk();
    },
     /**
     * 删除一个包的信息
     * @param {string} name 包名称
     * @param {Function} cbk 回调函数
     */
    remove: function(name, cbk){
        console.info('[synclist] remove:', name);
        this._map[name] = null;
        delete this._map[name];
        this.save();
        cbk();
    },
    /**
     * 固化包信息到文件
     * @return {void} [description]
     */
    save: function(){
        fsExtra.writeJsonSync(packageListPath, this._map);
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
            if((moduleStrategy && moduleStrategy[constant.CACHESTRATEGY.ALWAYSUPDATE]) || utils.isSnapshot(el)){
                hit[el] = {
                    flag: constant.CACHESTRATEGY.ALWAYSUPDATE
                };
            }
        });
        return hit;
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

module.exports = PackageList;
