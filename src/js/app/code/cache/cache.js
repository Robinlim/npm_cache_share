/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-14 14:07
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/



var _ = require('lodash'),
    utils = require('../../../common/utils');

/**
 * 缓存所有仓库和包的索引信息
 * @type {Object}
 */
function Cache(){
    this._cache = {};
    this._snapshotCache = {};
    this.storage = null;

}

Cache.prototype = {
    /**
     * 缓存就绪后执行
     * @return {Promise}
     */
    ready: function(){
        return new Promise(function(resolve, reject){
            resolve();
        });
    },
    /**
     * RELEASE和SNAPSHOT是一致的
     * @return {[type]} [description]
     */
    same: function(){
        this._cache = this._snapshotCache = {};
    },
    /**
     * 清空缓存
     * @return {[type]} [description]
     */
    clear: function(){
        this._cache = {};
        this._snapshotCache = {};
    },
    /**
     * 增加仓库
     * @param {Boolean} isSnapshot 是否是snapshot
     * @param {String} name 仓库名称
     * @param {Object} stat 仓库状态
     */
    addRepository: function(isSnapshot, name, stat){
        var cache = this.listAll(isSnapshot);
        if(cache[name]){
            cache[name].stat = stat;
            return;
        }
        cache[name] = {
            name: name,
            stat: stat,
            modules: {}
        }
    },
    /**
     * 删除仓库
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} name 仓库名称
     * @return {boolean}     是否删除成功
     */
    delRepository: function(isSnapshot, name) {
        if(isSnapshot){
            return delete this._snapshotCache[name];
        }
        return delete this._cache[name];
    },
    /**
     * 追加包到仓库
     * @param {Boolean} isSnapshot 是否是snapshot
     * @param {String} repository 仓库名称
     * @param {String} name       包名称，形如“five@0.0.1”
     */
    addPackage: function(isSnapshot, repository, name){
        var cache = this.listAll(isSnapshot);
        if(!cache[repository]){
            return false;
        }
        var modules = cache[repository].modules,
            moduleName = utils.splitModuleName(name);
        if(!modules[moduleName]){
            modules[moduleName] = [];
        }
        if(modules[moduleName].indexOf(name) < 0){
            modules[moduleName].push(name);
        }
        return true;
    },
    /**
     * 从仓库中删除包
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} repository 仓库名称
     * @param  {String} name       包名称
     * @return {boolean}           是否删除成功
     */
    delPackage: function(isSnapshot, repository, name) {
        var cache = this.listAll(isSnapshot);
        if(!cache[repository]){
            return false;
        }
        var modules = cache[repository].modules,
            moduleName = utils.splitModuleName(name),
            index;
        if(cache[repository].modules[moduleName]
            && (index = modules[moduleName].indexOf(name)) > -1){
            modules[moduleName].splice(index,1);
            if(modules[moduleName].length === 0){
                delete modules[moduleName];
            }
        }
    },
    /**
     * 返回缓存全部内容
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @return {Object} 缓存对象
     */
    listAll: function(isSnapshot) {
        return isSnapshot ? this._snapshotCache : this._cache;
    },
    /**
     * 返回仓库列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @return {Array} 数组每项包含name，stat
     */
    listRepository: function(isSnapshot){
        var cache = this.listAll(isSnapshot);
        return _.map(cache, function(v, k){
            return {name: k, stat: v.stat};
        });
    },
    /**
     * 返回模块列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {string} repository 仓库名称
     * @return {Array}            数组每项为模块名（不含版本号以及环境）
     */
    listModules: function(isSnapshot, repository){
        var cache = this.listAll(isSnapshot);
        return cache[repository] ? _.keys(cache[repository].modules) : [];
    },
    /**
     * 返回模块下的包列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {string} repository 仓库名称
     * @param  {string} name       模块名
     * @return {Array}            数组每项为包名称（含版本号以及环境）
     */
    listPackages: function(isSnapshot, repository, name){
        var cache = this.listAll(isSnapshot);
        return cache[repository].modules[name];
    },
    /**
     * 比较需要的模块与缓存内容，返回缓存中存在的包名称
     * @param  {string} repository 仓库名称
     * @param  {Array} list       所需的模块列表（包含版本号，不含环境）
     * @param  {string} platform   环境信息
     * @return {HashMap}            缓存存在的模块列表（包含版本号和环境）
     */
    diffPackages: function(repository, list, platform){
        if(!this._cache[repository] && !this._snapshotCache[repository]){
            return {};
        }
        var modules = this._cache[repository].modules,
            snapshotModules = this._snapshotCache[repository] ? this._snapshotCache[repository].modules : {},
            storage = this.storage,
            hit = {};
        _.forEach(list, function(name){
            var isSnapshot = utils.isSnapshot(name),
                moduleName = utils.splitModuleName(name),
                packages = isSnapshot ? snapshotModules[moduleName] : modules[moduleName];
            if(!packages){
                return;
            }
            var fileExt = utils.getFileExt(),
                packageNameForPlatform = utils.joinPackageName(name, platform),
                packageName = name;
            if(packages.indexOf(packageNameForPlatform + fileExt) > -1){
                hit[packageNameForPlatform] = {url: storage.get(repository, packageNameForPlatform + fileExt)};
            } else if (packages.indexOf(packageName + fileExt) > -1){
                hit[packageName] = {url: storage.get(repository, packageName + fileExt)};
            }
        });
        return hit;
    },
    setStorage: function(st){
        this.storage = st;
    }
};
/*@Factory("cache")*/
module.exports = Cache;
