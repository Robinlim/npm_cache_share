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
    tar = require('tar'),
    _ = require('lodash'),
    rpt = require('read-package-tree'),
    asyncMap = require("slide").asyncMap;

require('shelljs/global');

var utils = require('./utils'),
    Factory = require('../annotation/Factory'),
    constant = require('./constant');

var LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    __cwd = process.cwd(),
    __cache = utils.getCachePath();

module.exports = {
    /**
     * 分析依赖
     * @param  {Object} dependencies 模块依赖
     * @param  {Object} opts         指令参数
     * @param  {Function} callback   回调
     * @param  {String} modulename   指定安装的模块名
     * @return {void}
     */
    parse: function(dependencies, opts, callback, modulename) {
        console.info('初始化环境');
        //初始化参数
        this.registry = Factory.instance(opts.type, opts);
        //构建安装参数
        this.opts = utils.toString(opts, constant.NPMOPS);

        //确保本地缓存文件夹及node_modules存在并可写入
        utils.ensureDirWriteablSync(__cache);
        utils.ensureDirWriteablSync(path.resolve(__cache, LIBNAME));
        utils.ensureDirWriteablSync(path.resolve(__cache, UPLOADDIR));
        //确保工程目录node_modules存在并可写入
        utils.ensureDirWriteablSync(path.resolve(__cwd, LIBNAME));

        //创建package.json，否则安装会报warning
        fsExtra
            .writeJSONSync(path.resolve(__cache, 'package.json'), require('../../resource/package.js'));

        // 所需全部依赖
        this.dependencies = dependencies;
        // 本地缓存模块
        this.localCache = utils.lsDirectory(__cache);
        // 需要从远程获取的模块
        this.needFetch = this.compareLocal(this.dependencies);
        // 公共缓存模块（在公共服务check后填入）
        this.serverCache = {};
        // 需要本地安装的依赖 (在公共服务check后从needFetch中比较得出)
        this.needInstall = {};

        this.parseModule().then(function(){
            callback();
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
            this.serverCache = this.checkServer(this.needFetch).await();
            this.needInstall = this.compareServer(this.needFetch);

        } else {
            delete this.registry;
            this.needInstall = this.needFetch;
        }

        //下载公共模块
        this.download().await();

        //安装缺失模块
        this.installNews();

        //同步本地模块
        this.syncLocal().await();

        //打包模块至工程目录
        this.package();

        //新安装的模块同步到远程服务
        this.syncRemote().await();

        //删除缓存的node_modules目录
        console.info('删除临时目录');
        rm('-rf', path.resolve(__cache, UPLOADDIR));

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
        asyncMap(utils.toArrayByKey(this.serverCache), _.bind(function(packageName, cb){
            console.info('下载模块', packageName);
            this.registry.get(packageName, __cache, cb);
        }, this), callback);
    },
    /**
     * 安装缺失模块
     * @param  {JSON} modules   模块
     * @return {void}
     */
    installNews: function() {
        if (_.keys(this.needInstall).length === 0) {
            console.info('没有需要安装的缺失模块');
            return;
        } else {
            console.info('从npm安装缺失模块');
        }
        //抵达缓存目录
        cd(__cache);
        _.each(this.needInstall, _.bind(function(v, k) {
            //安装模块
            var npmName = [k, v.version].join('@');
            console.info('安装模块',npmName);

            if (exec('npm install ' + npmName + ' ' + this.opts).code !== 0) {
                throw npmName + ' install failed, please try by yourself!!';
            }
        }, this));
    },
    /**
     * 同步本地模块
     * @return {void}
     */
    /*@AsyncWrap*/
    syncLocal: function(callback) {
        console.info('同步本地模块');
        var files = ls(path.resolve(__cache, LIBNAME)),
            self = this,
            pcks = [],
            filesArr = [];

        files.forEach(function(file, i) {
            var filePath = path.resolve(__cache, LIBNAME, file);
            //存在私有域@开头的，只会存在一级
            if (!test('-f', path.resolve(filePath, 'package.json'))) {
                ls(filePath).forEach(function(file, j) {
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
            //temporary path for module cache
            var tpmc;
            utils.traverseTree(pcks, function(v, i, len) {
                tpmc = utils.getModuleName(v.package.name, v.package.version, v.package.dependencies, v.realpath);
                self.localCache[tpmc] = 1;
                if (self.serverCache[tpmc]) {
                    if (!self.localCache[tpmc]) {
                        //如果本地缓存不存在，而公共缓存存在，则移动至本地缓存目录
                        tpmc = path.resolve(__cache, tpmc);
                    }
                } else {
                    //如果公共缓存不存在该模块，则移动至上传目录
                    tpmc = path.resolve(__cache, UPLOADDIR, tpmc);
                }
                fsExtra.ensureDirSync(tpmc);
                cp('-rf', path.resolve(v.realpath, '*'), tpmc);
                //删除多余的node_modules空文件夹
                if (i == len - 1 && v.parent) {
                    rm('-rf', path.resolve(v.parent.realpath, LIBNAME));
                }
            });
            //同步上传目录至缓存目录 ?
            var uploadDir = path.resolve(__cache, UPLOADDIR);
            if (test('-d', uploadDir)  && ls(uploadDir).length > 0) {
                cp('-rf', path.resolve(__cache, UPLOADDIR, '*'), __cache);
            }
            //删除安装目录
            rm('-rf', path.resolve(__cache, LIBNAME));
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
        var pmp = path.resolve(__cwd, LIBNAME),
            cache = utils.lsDirectory(__cache),
            mn, tmp;
        //确保文件路径存在
        fsExtra.ensureDirSync(pmp);

        //循环同步依赖模块
        utils.traverseDependencies(this.dependencies, function(v, k, modulePath) {
            mn = utils.getModuleName(k, v.version);
            if (!cache[mn]) {
                mn = utils.getModuleNameForPlatform(k, v.version);
            }
            if (modulePath) {
                tmp = path.resolve(pmp, modulePath, LIBNAME, k);
            } else {
                tmp = path.resolve(pmp, k);
            }
            fsExtra.ensureDirSync(tmp);
            cp('-rf', path.resolve(__cache, mn, '*'), tmp);
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
        if (test('-d', uploadDir)  && ls(uploadDir).length > 0){
            console.info('上传模块到公共缓存');
            this.registry.put(uploadDir, callback);
        } else {
            console.info('没有需要上传的模块');
            callback();
        }
    },
    /**
     * 判断并读取公共缓存持有的本地所需依赖
     * @param  {JSON}   dependencies 模块依赖
     * @param  {Function} callback     回调
     * @return {void}                [description]
     */
    /*@AsyncWrap*/
    checkServer: function(dependencies, callback){
        var self = this;
        self.registry.check(utils.dependenciesTreeToArray(dependencies), function(avaliable, data) {
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
     * @return {JSON}
     */
    compareServer: function(dependencies) {
        return utils.compareCache(dependencies, this.serverCache);
    }
};
