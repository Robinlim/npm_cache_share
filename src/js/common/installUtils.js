/**
 * @Author: robin
 * @Date:   2016-08-08 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 11:21:41
 */

'use strict'
var path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    request = require('request'),
    _ = require('lodash'),
    rpt = require('read-package-tree'),
    slide = require("slide"),
    asyncMap = slide.asyncMap;

var utils = require('./utils'),
    npmUtils = require('./npmUtils'),
    shellUtils = require('./shellUtils'),
    constant = require('./constant');

var LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    MODULECHECKER = constant.MODULECHECKER,
    __cache = utils.getCachePath(),
    __cwd = process.cwd();

module.exports = {
    /**
     * 分析依赖
     * @param  {path}  base 执行安装的根路径
     * @param  {Registry} registry  一个registry实例
     * @param  {Object} dependencies 模块依赖
     * @param  {Object} opts         指令参数
     * @param  {Function} callback   回调
     * @return {void}
     */
    parse: function(base, registry, dependencies, opts, callback) {
        console.info('初始化环境');
        // 根路径
        this.base = base;
        // 缓存注册中心实例
        this.registry = registry;
        // 构建安装参数
        this.opts = opts;

        // 确保本地缓存文件夹及node_modules存在并可写入
        utils.ensureDirWriteablSync(__cache);
        utils.ensureDirWriteablSync(path.resolve(__cache, MODULECHECKER));
        // utils.ensureDirWriteablSync(path.resolve(__cache, LIBNAME));
        utils.ensureDirWriteablSync(path.resolve(__cache, UPLOADDIR));
        // 清空uploadDir
        fsExtra.emptyDirSync(path.resolve(__cache, UPLOADDIR));
        // 清空临时node_modules
        fsExtra.emptyDirSync(path.resolve(__cache, LIBNAME));
        // 确保工程目录node_modules存在并可写入
        utils.ensureDirWriteablSync(path.resolve(base, LIBNAME));
        //清空工程目录里的node_modules
        fsExtra.emptyDirSync(path.resolve(base, LIBNAME));

        // 所需全部依赖 过滤到不恰当的依赖
        this.dependencies = npmUtils.filter(dependencies);
        this.dependenciesArr = utils.dependenciesTreeToArray(this.dependencies);
        // 本地缓存模块
        this.localCache = utils.lsDirectory(__cache);
        // 需要从远程获取的模块
        this.needFetch = this.compareLocal(this.dependenciesArr);
        // 公共缓存模块（在公共服务check后填入）
        this.serverCache = {};
        // 需要本地安装的依赖 (在公共服务check后从needFetch中比较得出)
        this.needInstall = {};

        this.parseModule().then(function(val){
            console.debug(val);
            callback(null, val);
        },function(err) {
            console.error(err);
            callback(err);
        });
    },
    /**
     * 解析模块
     * @param  {Object}   dependencies 模块依赖
     * @param  {Function} callback     回调
     * @return {void}
     */
    /*@Async*/
    parseModule: function() {
        console.info('开始解析');

        //判断公共缓存是否存在
        if (this.registry && this.registry.check) {
            // 公共缓存拥有的模块
            var data = this.checkServer().await();
            this.serverCache = data.downloads || {};
            console.debug('将从中央缓存拉取的包：', this.serverCache);
            //需要强制与公共缓存更新的包
            this.alwaysUpdates = data.alwaysUpdates || {};
            console.debug('需要强制与公共缓存更新的包：', this.alwaysUpdates);
            //需要安装的包
            this.installs = data.installs || {};
            this.needInstall = this.compareServer(this.needFetch, this.installs);
            console.debug('需要初次安装的包：', this.needInstall);
            //需要安装后执行的模块
            this.postinstall = data.postinstall || {};
            console.debug('需要安装后执行的模块：', this.postinstall);
        } else {
            delete this.registry;
            this.needInstall = this.needFetch;
        }

        //下载公共模块
        this.download().await();

        //安装缺失模块并同步到本地
        this.installNews().await();

        //打包模块至工程目录
        this.package();

        //新安装的模块同步到远程服务
        this.syncRemote().await();

        //删除缓存的node_modules目录,安装目录
        console.debug('删除临时目录');
        shellUtils.rm('-rf', path.resolve(__cache, UPLOADDIR));
        shellUtils.rm('-rf', path.resolve(__cache, LIBNAME));

        return {
            downloadNum: _.keys(this.serverCache).length,
            installNum: this.needInstall.length
        };
    },
    /**
     * 下载公共缓存模块
     * @return {void}
     */
    /*@AsyncWrap*/
    download: function(callback){
        if(_.keys(this.serverCache).length === 0) {
            console.info('没有需要下载的模块');
            callback();
            return;
        } else {
            console.info('从公共缓存下载模块');
        }
        //转换成数组
        var rs = _.map(this.serverCache, function(v,k){
                return k;
            }),
            self = this, start = 0, count = constant.LOAD_MAX_RESOUCE;

        //控制分批下载资源，会受服务的网络连接数的限制
        (function loadCtrl(){
            loadResource(rs.slice(start, start = start + count), function(){
                if(start >= rs.length){
                    callback();
                    return;
                }
                loadCtrl();
            });
        })();
        //同时下载资源
        function loadResource(resource, callback){
            asyncMap(
                resource,
                _.bind(function(packageName, cb){
                    console.debug('下载模块', packageName);
                    this.registry.get(packageName, this.serverCache[packageName].url, __cache, function(err){
                        if(err){
                            cb(err);
                        } else {
                            fs.writeFileSync(path.resolve(__cache, MODULECHECKER, packageName), '');
                            cb();
                        }
                    });
                }, self),
                callback
            );
        }
    },
    /**
     * 安装缺失模块
     * @param  {JSON} modules   模块
     * @return {void}
     */
    /*@Async*/
    installNews: function() {
        if (this.needInstall.length === 0) {
            console.info('没有需要安装的缺失模块');
            return;
        } else {
            console.info('从npm安装缺失模块');
        }
        var installs = this.installs,
            alwaysUpdates = this.alwaysUpdates,
            bundles = [],
            forInstlBundles = [],
            map = {}, bundlesTmp;
        //处理模块安装的批次，相同模块不同版本的安装批次不一样
        _.forEach(this.needInstall, function(el) {
            var name = el.name,
                bundleId = 0,
                bundlesTmp = bundles;
            if(installs[name] || alwaysUpdates[name]){
                bundlesTmp = forInstlBundles;
            }
            if(!map[name]) {
                map[name] = 1;
            } else {
                bundleId = map[name]
                map[name]++;
            }
            if(!bundlesTmp[bundleId]) {
                bundlesTmp[bundleId] = [];
            }
            bundlesTmp[bundleId].unshift([name, el.version].join('@'));
        });

        console.debug('即将分批安装的模块：',bundles);
        var counter = {
            total: this.needInstall.length,
            cur: 0
        };
        //安装模块，在临时目录上执行
        _.forEach(bundles, _.bind(function(el){
            this._installBundle(el, __cache, counter);
            this._syncLocal(el, __cache).await();
        }, this));
        //安装模块，在工程路径上执行
        _.forEach(forInstlBundles, _.bind(function(el){
            this._installBundle(el, this.base, counter, true);
            this._syncLocal(el, this.base).await();
        }, this));
    },
    /**
     * 批量安装一批npm依赖
     * @param {Array} pcks      需要被安装的包，每一项为“name@version”形式
     * @param {String} curPath  安装所在的路径
     * @param {Object} counter  一个用于进度的计数器
     * @param {Boolean} notSave 是否不同步到package.json
     * @return {Array}
     */
    _installBundle: function(pcks, curPath, counter, notSave){
        var maxBundle = constant.NPM_MAX_BUNDLE;
        for(var i = 0; i < pcks.length; i += maxBundle){
            var start = i, end = i+maxBundle < pcks.length ? i+maxBundle : pcks.length,
                part = pcks.slice(start, end);
            console.debug('安装模块', part);
            npmUtils.npmInstallModules(part, this.opts, {
                cwd: curPath,
                silent: !global.DEBUG
            }, notSave);
            counter.cur += part.length;
            console.info('已安装：', counter.cur, '/', counter.total);
        }
    },
    /**
     * 同步本地模块
     * @param  {Array} files        需要被同步的文件名称
     * @param  {String} curPath     安装所在的路径
     * @param  {Function} callback  完成后的回调
     * @return {void}            [description]
     */
    /*@AsyncWrap*/
    _syncLocal: function(files, curPath, callback) {
        var self = this,
            installs = this.installs,
            alwaysUpdates = this.alwaysUpdates,
            pcks = [],
            filesArr = [];

        _.forEach(files, function(file, i) {
            var filePath = path.resolve(curPath, LIBNAME, utils.splitModuleName(file));
            //存在私有域@开头的，只会存在一级
            if (!shellUtils.test('-f', path.resolve(filePath, 'package.json'))) {
                shellUtils.ls(filePath).forEach(function(file, j) {
                    filesArr.push(path.resolve(filePath, file));
                });
            } else {
                filesArr.push(filePath);
            }
        });

        asyncMap(filesArr, function(filePath, cb){
            rpt(filePath, function(err, data) {
                if (err) {
                    cb(err);
                } else {
                    pcks.push(data);
                    cb();
                }
            });
        }, function(err){
            if(err){
                callback(err);
            }
            utils.traverseTree(pcks, function(v, i, len) {
                var name = v.package.name,
                    tpmc = utils.getModuleName(name, v.package.version, v.package.dependencies, v.realpath),
                    target;
                //如果是强制安装策略，或者强制更新策略，则不同步到服务器
                //如果公共缓存不存在该模块，则移动至上传目录
                if(!self.serverCache[tpmc] && !(installs[name] || alwaysUpdates[name])){
                    target = path.resolve(__cache, UPLOADDIR, tpmc);
                    shellUtils.cp('-rf', path.resolve(v.realpath), target);
                }
                //如果本地缓存不存在，则移动至本地缓存目录
                if(!self.localCache[tpmc]){
                    target = path.resolve(__cache, tpmc);
                    shellUtils.cp('-rf', path.resolve(v.realpath), target);
                    self.localCache[tpmc] = 1;
                    fs.writeFileSync(path.resolve(__cache, MODULECHECKER, tpmc), '');
                }
                //删除多余的node_modules空文件夹
                if (i == len - 1 && v.parent) {
                    shellUtils.rm('-rf', path.resolve(v.parent.realpath, LIBNAME));
                }
            });
            callback();
        });
    },
    /**
     * 组装模块
     * @param  {Object} dependencies 模块依赖
     * @return {void}
     */
    package: function() {
        console.info('开始打包模块');
        //project module path
        var self = this,
            pmp = path.resolve(this.base, LIBNAME),
            cache = utils.lsDirectory(__cache),
            postinstall = this.postinstall, 
            postRunsPath = {},
            mn, tmp;
        //确保文件路径存在
        fsExtra.ensureDirSync(pmp);
        //循环同步依赖模块
        utils.traverseDependencies(this.dependencies, function(v, k, modulePath) {
            if(!v.version){
                return;
            }
            mn = utils.getModuleName(k, v.version);
            if (!cache[mn]) {
                mn = utils.getModuleNameForPlatform(k, v.version);
            }
            if (modulePath) {
                tmp = path.resolve(pmp, modulePath, LIBNAME, k);
            } else {
                tmp = path.resolve(pmp, k);
            }
             if(postinstall[k]){
                postRunsPath[k] = tmp;
            }
            fsExtra.ensureDirSync(path.resolve(tmp, '..'));
            if(shellUtils.test('-d', path.resolve(__cache, mn))){
                // 先删除原有的目录
                shellUtils.rm('-rf', tmp);
                console.debug('cp -rf', path.resolve(__cache, mn), tmp);
                shellUtils.cp('-rf', path.resolve(__cache, mn), tmp);
            } else {
                console.error('Cannot find packages:', mn);
                process.exit(1);
            }
        }, this.base);
        console.info('开始执行定制脚本');
        //执行npm run postinstall,或者其他自定义脚本
        _.map(postRunsPath, function(v, k){
            _.forEach(postinstall[k].split(','), function(ac){
                npmUtils.npmRunScript(ac, {
                    cwd: postRunsPath[k],
                    async: false       
                }, function(err){
                    if(err){
                        throw err;
                    }
                });                
            });
        });
    },
    /**
     * 同步远程服务
     * @param  {String}   modulePath 模块路径
     * @param  {Function} callback   回调
     * @return {void}
     */
    /*@AsyncWrap*/
    syncRemote: function(callback) {
        if (!this.registry) {
            callback();
            return;
        }
        var uploadDir = path.resolve(__cache, UPLOADDIR);
        if (shellUtils.test('-d', uploadDir)  && shellUtils.ls(uploadDir).length > 0){
            console.info('上传模块到公共缓存');
            this.registry.put(uploadDir, false, callback);
        } else {
            console.info('没有需要上传的模块');
            callback();
        }
    },
    /**
     * 判断并读取公共缓存持有的本地所需依赖
     * @param  {Function} callback     回调
     * @return {void}                [description]
     */
    /*@AsyncWrap*/
    checkServer: function(callback){
        var self = this,
            list = _.map(this.needFetch, 'full'),
            checkSyncList = [],
            localCache = this.localCache;
        //对比出本地存在的依赖模块
        _.forEach(this.dependenciesArr, function(el){
            if(localCache[el.full]){
                checkSyncList.push(el.full);
            }
        });
        self.registry.check(list, checkSyncList, function(avaliable, data) {
            if(!avaliable){
                delete self.registry;
                callback(null, {});
            } else {
                callback(null, data);
            }
        });
    },
    /**
     * 对比本地未安装模块
     * @param  {JSON} dependencies   模块依赖
     * @return {JSON}
     */
    compareLocal: function(dependencies) {
        return utils.compareCache(dependencies, this.localCache);
    },
    /**
     * 对比公共缓存服务未安装的模块
     * @param  {JSON} dependencies 模块依赖，打平后只有一级
     * @param  {JSON} installs     避免重复
     * @return {JSON}
     */
    compareServer: function(dependencies, installs) {
        var repeats = {},
            modules = utils.compareCache(dependencies, this.serverCache, function(el){
                if(installs[el.name]){
                    repeats[el.name] = 1;
                }
            });
        //增加强制安装策略的模块，有可能是本地缓存的模块
        _.forEach(installs, function(v, k){
            console.info(k);
            if(!repeats[k]){
                modules.push({
                    name: k,
                    version: utils.splitModuleVersion(v),
                    full: v
                });
            }
        });
        return modules;
    }
};
