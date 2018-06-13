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
    async = require("async"),
    asyncMap = async.every;

var utils = require('./utils'),
    npmUtils = require('./npmUtils'),
    shellUtils = require('./shellUtils'),
    constant = require('./constant');

var LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    MODULECHECKER = constant.MODULECHECKER,
    __cache = utils.getCachePath();

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
        var curtimestampe = '' + Date.now();
        // 根路径
        this.base = base;
        // 缓存注册中心实例
        this.registry = registry;
        // 构建安装参数
        this.opts = opts;
        // 临时目录
        this.tmpPath = path.resolve(__cache, curtimestampe);
        this.uploadTmpPath = path.resolve(__cache, curtimestampe, UPLOADDIR);

        // 确保本地缓存文件夹及node_modules存在并可写入
        utils.ensureDirWriteablSync(__cache);
        utils.ensureDirWriteablSync(path.resolve(__cache, MODULECHECKER));
        // 确保工程目录node_modules存在并可写入
        utils.ensureDirWriteablSync(path.resolve(base, LIBNAME));
        utils.ensureDirWriteablSync(path.resolve(base, LIBNAME, '.bin'));
        // 确保临时安装目录存在
        utils.ensureDirWriteablSync(this.tmpPath);
        // node0.12.7安装compressible模块时会查找node_modules目录，没有会往上层查找，故需提前创建，高版本node没有此问题
        utils.ensureDirWriteablSync(path.resolve(this.tmpPath, LIBNAME));
        // 确保上传目录存在
        utils.ensureDirWriteablSync(this.uploadTmpPath);

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
    parseModule: function() {
        console.info('开始解析');
        var self = this;
        return new Promise(function(resolve, reject){
            //判断公共缓存是否存在
            if (self.registry && self.registry.check) {
                //公共缓存拥有的模块
                self.checkServer().then(function(data){
                    self.serverCache = data.downloads || {};
                    console.debug('将从中央缓存拉取的包：', self.serverCache);
                    //需要强制与公共缓存更新的包
                    self.alwaysUpdates = data.alwaysUpdates || {};
                    console.debug('需要强制与公共缓存更新的包：', self.alwaysUpdates);
                    //需要安装的包
                    self.installs = data.installs || {};
                    self.needInstall = self.compareServer(self.needFetch, self.installs);
                    console.debug('需要初次安装的包：', self.needInstall);
                    //需要安装后执行的模块
                    self.postinstall = data.postinstall || {};
                    console.debug('需要安装后执行的模块：', self.postinstall);
                    //需要强制重构建的模块
                    self.rebuilds = data.rebuilds || {};
                    console.debug('需要强制重构建的模块：', self.rebuilds);
                    //黑名单模块
                    if((self.blacks = data.blacks || []).length > 0 && !self.opts.ignoreBlackList){
                        self.clean();
                        throw new Error('存在黑名单模块：' + self.blacks);
                    }
                    instDeal();
                });
            } else {
                delete self.registry;
                self.needInstall = self.needFetch;
                instDeal();
            }
            function instDeal(){
                async.series([
                    //下载公共模块
                    _.bind(self.download, self),
                    //安装缺失模块并同步到本地
                    _.bind(self.installNews, self),
                    //打包模块至工程目录
                    _.bind(self.package, self),
                    //新安装的模块同步到远程服务
                    _.bind(self.syncRemote, self)
                ], function(err, results){
                    //清理现场
                    self.clean(); 
                    if(err){
                        reject(err);
                    }else{
                        resolve({
                            downloadNum: _.keys(self.serverCache).length,
                            installNum: self.needInstall.length
                        });
                    }
                });
            }
        });
    },
    /**
     * 下载公共缓存模块
     * @param  {Function} callback
     * @return {void}
     */
    download: function(callback){
        //转换成数组
        var rs = _.map(this.serverCache, function(v,k){
                return k;
            });
        if(rs.length === 0) {
            console.info('没有需要下载的模块');
            callback();
            return;
        } 
        console.info('从公共缓存下载模块');
        var self = this, start = 0, count = constant.LOAD_MAX_RESOUCE;
        
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
                function(packageName, cb){
                    console.debug('下载模块', packageName);
                    self.registry.get(packageName, self.serverCache[packageName].url, __cache, function(err){
                        if(err){
                            self.clean();
                            cb(packageName + ' ' + err);
                        } else {
                            console.debug('下载完成', packageName);
                            fs.writeFileSync(path.resolve(__cache, MODULECHECKER, packageName), '');
                            cb(null, true);
                        }
                    });
                },
                callback
            );
        }
    },
    /**
     * 安装缺失模块
     * @return {void}
     */
    installNews: function(callback) {
        if (this.needInstall.length === 0) {
            console.info('没有需要安装的缺失模块');
            callback();
            return;
        } else {
            console.info('从npm安装缺失模块');
        }
        var installs = this.installs,
            bundles = [],
            forInstlBundles = [],
            map = {}, bundlesTmp;
        //处理模块安装的批次，相同模块不同版本的安装批次不一样
        _.forEach(this.needInstall, function(el) {
            var name = el.name,
                bundleId = 0,
                bundlesTmp = bundles;
            if(installs[name]){
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
            },
            self = this;
        
        async.auto({
            tmpInst: function(cb){
                //安装模块，在临时目录上执行
                console.debug('安装路径：',self.tmpPath);
                async.everySeries(bundles, function(el, callback){
                    self._installBundle(el, self.tmpPath, counter);
                    self._syncLocal(el, self.tmpPath, callback);
                }, cb);
            },
            projInst: ['tmpInst', function(results, cb){
                if(forInstlBundles.length > 0){
                    console.debug('即将分批安装的模块：',forInstlBundles);
                    console.debug('安装路径：',self.base);
                    //安装模块，在工程路径上执行
                    async.everySeries(forInstlBundles, function(el, callback){
                        self._installBundle(el, self.base, counter, true);
                        self._syncLocal(el, self.base, callback);
                    }, cb);
                }else{
                    cb();
                }
            }]
        }, function(err){
            callback(err);
        });
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
    _syncLocal: function(files, curPath, callback) {
        var self = this,
            installs = this.installs,
            alwaysUpdates = this.alwaysUpdates,
            pcks = [],
            filesArr = [];

        _.forEach(files, function(file, i) {
            var filePath = path.resolve(curPath, LIBNAME, utils.splitModuleName(file));
            //存在私有域@开头的，只会存在一级
            if(!fs.existsSync(filePath)){
                throw new Error(filePath + ' not exists!!!');
            }
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
                    cb(null, true);
                }
            });
        }, function(err){
            if(err){
                callback(err);
                return;
            }
            utils.traverseTree(pcks, function(v, i, len) {
                var name = v.package.name,
                    tpmc = utils.getModuleName(name, v.package.version, v.package.dependencies, v.realpath),
                    target;
                //如果是强制安装策略，或者强制更新策略，则不同步到服务器
                //如果公共缓存不存在该模块，则移动至上传目录
                if(!self.serverCache[tpmc] && !(installs[name] || alwaysUpdates[name])){
                    target = path.resolve(self.uploadTmpPath, tpmc);
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
            callback(null, true);
        });
    },
    /**
     * 组装模块
     * @param  {Object} dependencies 模块依赖
     * @return {void}
     */
    package: function(callback) {
        console.info('开始打包模块');
        //project module path
        var pmp = path.resolve(this.base, LIBNAME),
            cache = utils.lsDirectory(__cache),
            postinstall = this.postinstall, 
            rebuilds = this.rebuilds,
            rebuildsPath = [],
            postRunsPath = {},
            mn, tmp, mnPath, packageInfo;
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
            if(rebuilds[mn]){
                rebuildsPath.push(tmp);
            }
            fsExtra.ensureDirSync(path.resolve(tmp, '..'));
            mnPath = path.resolve(__cache, mn);
            if(shellUtils.test('-d', mnPath)){
                // 先删除原有的目录
                shellUtils.rm('-rf', tmp);
                console.debug('cp -rf', mnPath, tmp);
                shellUtils.cp('-rf', mnPath, tmp);
                // 查看是否有bin
                packageInfo = fsExtra.readJsonSync(path.resolve(tmp, 'package.json'));
                if(packageInfo.bin){
                    var srcSouce, targetPath;
                    if(typeof packageInfo.bin == 'string'){
                        srcSouce = path.resolve(pmp, '.bin', mn);
                        targetPath = path.resolve(tmp, packageInfo.bin);
                        console.info('建立软链:' + srcSouce + ',' + targetPath);
                        fsExtra.ensureSymlinkSync(targetPath, srcSouce);
                    }else{
                        _.map(packageInfo.bin, function(v, k){
                            srcSouce = path.resolve(pmp, '.bin', k);
                            targetPath = path.resolve(tmp, v);
                            console.info('建立软链:' + srcSouce + ',' + targetPath);
                            fsExtra.ensureSymlinkSync(targetPath, srcSouce);
                        });
                    }
                }
            } else {
                // 错误模块保留现场
                // self.clean();
                throw new Error('Cannot find packages ' + mn + ':' + mnPath);
            }
        }, this.base);
        if(postRunsPath){
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
        }
        
        if(rebuildsPath.length > 0){
            console.info('开始执行模块编译');
            //执行npm install，针对SNAPSHOT版本需要gyp编译的模块
            asyncMap(rebuildsPath, function(bpath, cb){
                npmUtils.npmInstall({}, {
                    cwd: bpath,
                    async: false       
                }, function(err){
                    cb(err, true);
                });
            }, function(err){
                callback(err);
            });
        }else{
            callback();
        }
    },
    /**
     * 同步远程服务
     * @param  {String}   modulePath 模块路径
     * @param  {Function} callback   回调
     * @return {void}
     */
    syncRemote: function(callback) {
        if (!this.registry) {
            callback();
            return;
        }
        var uploadDir = this.uploadTmpPath;
        if (shellUtils.test('-d', uploadDir)  && shellUtils.ls(uploadDir).length > 0){
            console.info('上传模块到公共缓存');
            this.registry.put(uploadDir, false, callback);
        } else {
            console.info('没有需要上传的模块');
            callback();
        }
    },
    /**
     * 删除临时目录
     */
    clean: function(){
        console.debug('删除临时目录');
        shellUtils.rm('-rf', this.uploadTmpPath);
        shellUtils.rm('-rf', this.tmpPath);
    },
    /**
     * 判断并读取公共缓存持有的本地所需依赖
     * @return {Promise}               
     */
    checkServer: function(){
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
        return new Promise(function(resolve){
            self.registry.check(list, checkSyncList, function(avaliable, data) {
                if(!avaliable){
                    delete self.registry;
                    resolve({});
                } else {
                    resolve(data);
                }
            });
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
