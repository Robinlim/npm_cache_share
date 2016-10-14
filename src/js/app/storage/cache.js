/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-14 14:07
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-14 14:07
*/



var utils = rquire('../../common/utils');

/**
 * 缓存所有仓库和包的索引信息
 * @type {Object}
 */
var _cache = {};

module.exports = {
    /**
     * 增加仓库
     * @param {String} name 仓库名称
     * @param {Object} stat 仓库状态
     */
    addRepository: function(name, stat){
        if(_cache[name]) {
            return false;
        } else {
            _cache[name] = {
                name: name,
                stat: stat,
                modules: {}
            }
            return true;
        }
    },
    /**
     * 删除仓库
     * @param  {String} name 仓库名称
     * @return {boolean}     是否删除成功
     */
    delRepository: function(name) {
        return delete _cache[name];
    },
    /**
     * 追加包到仓库
     * @param {String} repository 仓库名称
     * @param {String} name       包名称，形如“five@0.0.1”
     */
    addPackage: function(repository, name){
        if(!_cache[repository]){
            return false;
        }
        var modules = _cache[repository].modules,
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
     * @param  {String} repository 仓库名称
     * @param  {String} name       包名称
     * @return {boolean}           是否删除成功
     */
    delPackage: function(repository, name) {
        if(!_cache[repository]){
            return false;
        }
        var modules = _cache[repository].modules,
            moduleName = utils.splitModuleName(name),
            index;
        if(_cache[repository].modules[moduleName]
            && (index = modules[moduleName].indexOf(name)) > -1){
            modules[moduleName].splice(index,1);
            if(modules[moduleName].length === 0){
                delete modules[moduleName];
            }
        }
    },
    /**
     * 返回缓存全部内容
     * @return {Object} 缓存对象
     */
    listAll: function() {
        return _cache;
    },
    /**
     * 返回仓库列表
     * @return {Array} 数组每项包含name，stat
     */
    listRepository: function(){
        return _.map(_cache, function(v, k){
            return {name: k, stat: v.stat};
        });
    },
    /**
     * 返回模块列表
     * @param  {string} repository 仓库名称
     * @return {Array}            数组每项为模块名（不含版本号以及环境）
     */
    listModules: function(repository){
        return _.keys(_cache[repository].modules);
    },
    /**
     * 返回模块下的包列表
     * @param  {string} repository 仓库名称
     * @param  {string} name       模块名
     * @return {Array}            数组每项为包名称（含版本号以及环境）
     */
    listPackages: function(repository, name){
        return _cache[repository].modules[name];
    },
    /**
     * 比较需要的模块与缓存内容，返回缓存中存在的包名称
     * @param  {string} repository 仓库名称
     * @param  {Array} list       所需的模块列表（包含版本号，不含环境）
     * @param  {string} platform   环境信息
     * @return {HashMap}            缓存存在的模块列表（包含版本号和环境）
     */
    diffPackages: function(repository, list, platform){
        if(!_cache[repository]){
            return {};
        }
        var modules = _cache[repository].modules,
            hit = {};
        _.forEach(list, function(name){
            var moduleName = utils.splitModuleName(name),
                packages = modules[moduleName];
            if(!packages){
                return;
            }
            var fileExt = utils.getFileExt(),
                packageNameForPlatform = utils.joinPackageName(name, platform),
                packageName = name;
            if(packages.indexOf(packageNameForPlatform + fileExt) > -1){
                hit[packageNameForPlatform] = 1;
            } else if (packages.indexOf(packageName + fileExt) > -1){
                hit[packageName] = 1;
            }
        });
        return hit;
    }
};
