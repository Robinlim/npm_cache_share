/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-14 14:07
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/



var _ = require('lodash'),
    utils = require('../../../common/utils'),
    CACHESTRATEGY = require('../../../common/constant').CACHESTRATEGY;

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
        //因为zkCache优先渲染RELEASE，再渲染SNAPSHOT
        this._snapshotCache = this._cache;
    },
    /**
     * 清空缓存
     * @return {[type]} [description]
     */
    clear: function(){
        console.info('清除本地缓存');
        this._cache = {};
        this._snapshotCache = {};
        return new Promise(function(resolve, reject){
            resolve();
        });
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
            moduleName = utils.isModuleVersion(name) ? utils.splitModuleName(name) : name;
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
        var modules = cache[repository].modules;
        if(utils.isModuleVersion(name)){
            var moduleName =  utils.splitModuleName(name),
                index;
            if(modules[moduleName]
                && (index = modules[moduleName].indexOf(name)) > -1){
                modules[moduleName].splice(index,1);
                if(modules[moduleName].length === 0){
                    modules[moduleName] = null;
                    delete modules[moduleName];
                }
            }
        }else{
            modules[name] = null;
            delete modules[name];
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
        var cache = this.listAll(isSnapshot);
        if(!cache[repository]){
            return false;
        }
        var modules = cache[repository].modules;
        if(cache[repository].modules[moduleName]){
            delete cache[repository].modules[moduleName];
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
     * @param  {String} repository 仓库名称
     * @return {Array}            数组每项为模块名（不含版本号以及环境）
     */
    listModules: function(isSnapshot, repository){
        var cache = this.listAll(isSnapshot);
        return cache[repository] ? _.keys(cache[repository].modules) : [];
    },
    /**
     * 返回模块下的包列表
     * @param  {Boolean} isSnapshot 是否是snapshot
     * @param  {String} repository  仓库名称
     * @param  {String} name        模块名
     * @return {Array}              数组每项为包名称（含版本号以及环境）
     */
    listPackages: function(isSnapshot, repository, name){
        var cache = this.listAll(isSnapshot);
        return cache[repository].modules[name];
    },
    /**
     * 比较需要的模块与缓存内容，返回缓存中存在的包名称
     * @param  {String} repos      仓库名称
     * @param  {Array} list        所需的模块列表（包含版本号，不含环境）
     * @param  {Array} userLocals  用户本地缓存
     * @param  {String} platform   环境信息
     * @param  {Object} strategies 模块策略
     * @return {HashMap}           缓存存在的模块列表（包含版本号和环境）
     */
    diffPackages: function(repos, list, userLocals, platform, strategies){
        if(!this._cache[repos.release] && !this._snapshotCache[repos.snapshot]){
            return {};
        }
        var repository = repos.release,
            snapRepo = repos.snapshot,
            modules = (this._cache[repository]||{}).modules,
            snapshotModules = (this._snapshotCache[snapRepo]||{}).modules,
            storage = this.storage,
            fileExt = utils.getFileExt(),
            downloads = {},
            alwaysUpdates = {}, //有alwaysUpdates为1时，downloads也会存在
            installs = {},
            postinstalls = {},
            rebuilds = {},
            blacks = [],
            strategy;

        //服务端缓存
        _.forEach(list, function(name){
            var moduleName = utils.splitModuleName(name),
                isSnapshot = utils.isSnapshot(name),
                repo = isSnapshot ? snapRepo : repository,
                packages = isSnapshot ? snapshotModules[moduleName] || snapshotModules[name + fileExt] : modules[moduleName] || modules[name + fileExt];
            if(strategy = strategies[name] || strategies[moduleName]){
                if(strategy[CACHESTRATEGY.BLACKLIST]){
                    blacks.push(name);
                }
            }
            if(!packages){
                return;
            }
            if(strategy){
                //如果有忽略缓存策略，则忽略其他策略，相当于真实安装
                if(strategy[CACHESTRATEGY.IGNORECACHE]){
                    installs[moduleName] = name;
                    return;
                }
                //如果有强制同步服务端策略，则本地缓存失效
                if(strategy[CACHESTRATEGY.ALWAYSUPDATE]){
                    alwaysUpdates[moduleName] = 1;
                }
                //安装后执行策略
                if(strategy[CACHESTRATEGY.POSTINSTALL]){
                    postinstalls[moduleName] = strategy[CACHESTRATEGY.POSTINSTALL];
                }
            }
            var packageNameForPlatform = utils.joinPackageName(name, platform),
                packageName = name;
            if(packages.indexOf(packageNameForPlatform + fileExt) > -1){
                downloads[packageNameForPlatform] = {url: storage.get(repo, packageNameForPlatform + fileExt)};
            } else if (packages.indexOf(packageName + fileExt) > -1){
                downloads[packageName] = {url: storage.get(repo, packageName + fileExt)};
            }
            //gyp模块，需要执行编译，一般只有包发布SNAPSHOT版本的时需要考虑
            if(isSnapshot && strategy && strategy.isGyp){
                rebuilds[packageName] = 1;
            }
        });
        
        //客户端缓存
        _.forEach(userLocals, function(name){
            var moduleName = utils.splitModuleName(name),
                isSnapshot = utils.isSnapshot(name),
                repo = isSnapshot ? snapRepo : repository;
            //由于是以SNAPSHOT为依据，该标示只出现在版本号，则会影响SNAPSHOT对应的版本
            if(isSnapshot){
                alwaysUpdates[name] = 1;
            }
            if(!(strategy = strategies[name] || strategies[moduleName])){
                isSnapshot && downloadDeal();
                return;
            }
            //如果存在黑名单，则忽略其他策略
            if(strategy[CACHESTRATEGY.BLACKLIST]){
                blacks.push(name);
                return;
            }
            //如果有忽略缓存策略，则忽略其他策略，相当于真实安装
            if(strategy[CACHESTRATEGY.IGNORECACHE]){
                installs[moduleName] = name;
                return;
            }
            //gyp模块，需要执行编译，一般只有包发布SNAPSHOT版本的时需要考虑
            if(isSnapshot && strategy && strategy.isGyp){
                rebuilds[name] = 1;
            }
            //如果有强制同步服务端策略，则本地缓存失效
            if(strategy[CACHESTRATEGY.ALWAYSUPDATE] || isSnapshot){
                downloadDeal();
                !isSnapshot && (alwaysUpdates[moduleName] = 1);
            }
            if(strategy[CACHESTRATEGY.POSTINSTALL]){
                postinstalls[moduleName] = strategy[CACHESTRATEGY.POSTINSTALL];
            }
            function downloadDeal(){
                var packages = isSnapshot ? snapshotModules[moduleName] || snapshotModules[name + fileExt] : modules[moduleName] || modules[name + fileExt];
                if(!packages){
                    installs[moduleName] = name;
                    return;
                }
                var packageNameForPlatform = utils.joinPackageName(name, platform);
                if(packages.indexOf(packageNameForPlatform + fileExt) > -1){
                    downloads[packageNameForPlatform] = {url: storage.get(repo, packageNameForPlatform + fileExt)};
                } else if (packages.indexOf(name + fileExt) > -1){
                    downloads[name] = {url: storage.get(repo, name + fileExt)};
                }
            }
        });
        return {
            downloads: downloads,
            alwaysUpdates: alwaysUpdates,
            installs: installs,
            postinstall: postinstalls,
            rebuilds: rebuilds,
            blacks: blacks
        };
    },
    setStorage: function(st){
        this.storage = st;
    },
    getStorage: function() {
        return this.storage;
    }
};

module.exports = Cache;
