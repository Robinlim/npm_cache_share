/**
 * @Author: robin
 * @Date:   2016-08-08 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-18 19:21:29
 */

'use strict'
var path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    request = require('request'),
    tar = require('tar'),
    _ = require('lodash'),
    rpt = require('read-package-tree');

require('shelljs/global');

var utils = require('./utils'),
    Factory = require('../annotation/Factory'),
    constant = require('./constant');

var LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    __cwd = process.cwd(),
    __cache = utils.getCachePath(),
    cache = {};

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
        // fsExtra
        //     .writeJson(path.resolve(__cache, 'package.json'), require('../../resource/package.js'), function(err){
        //         console.error(err);
        //     });

        //获取当前缓存模块
        this.localCache = utils.lsDirectory(__cache);
        this.serverCache = {};

        console.info('开始解析');
        var self = this;
        //判断公共缓存是否存在
        if (this.registry && this.registry.check) {
            this.registry.check(_.bind(function(avaliable) {
                // 公共缓存是否可用
                if (avaliable) {
                    parse();
                } else {
                    delete this.registry;
                    parse();
                }
            }, this));
        } else {
            delete this.registry;
            parse();
        }

        function parse() {
            self.parseModule(dependencies, callback).catch(function(err) {
                console.error(err);
            });
        }
    },
    /**
     * 解析模块
     * @param  {Object}   dependencies 模块依赖
     * @param  {Function} callback     回调
     * @return {void}
     */
    /*@Async*/
    parseModule: function(dependencies, callback) {
        console.info('匹配缓存模块');
        //对比本地未安装的模块
        var news = this.compareLocal(dependencies);

        //对比公共缓存未安装的模块
        news = this.compareServer(news);

        if (_.keys(news).length > 0) {
            console.info('安装模块');
            //安装缺失模块
            this.installNews(news).await();
        }
        console.info('开始打包模块');
        //打包模块至工程目录
        this.package(dependencies);

        //需要将新的模块同步到远程服务
        this.syncRemote(path.resolve(__cache, UPLOADDIR), function(err) {
            //删除缓存的node_modules目录
            console.info('删除临时目录');
            rm('-rf', path.resolve(__cache, UPLOADDIR));
            callback(err);
        });
    },
    /**
     * 安装缺失模块
     * @param  {JSON} modules   模块
     * @return {void}
     */
    /*@Async*/
    installNews: function(modules) {
        _.each(modules, _.bind(function(v, k) {
            if (!this.localCache[utils.getModuleName(k, v.version)] &&
                !this.localCache[utils.getModuleNameForPlatform(k, v.version)]) {
                //安装模块
                this.install(k, v.version);
                //同步本地模块
                this.syncLocal().await();
            }
        }, this));
    },
    /**
     * 本地安装模块，依赖扁平化
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @return {void}
     */
    install: function(name, version) {
        //抵达缓存目录
        cd(__cache);

        var npmName = [name, version].join('@');

        console.info('安装' + npmName);

        if (exec('npm install ' + npmName + ' ' + this.opts).code !== 0) {
            throw npmName + ' install failed, please try by yourself!!';
        }
    },
    /**
     * 同步本地模块
     * @return {void}
     */
    /*@AsyncWrap*/
    syncLocal: function(cb) {
        var files = ls(path.resolve(__cache, LIBNAME)),
            self = this,
            pcks = [],
            filesArr = [],
            count;
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

        count = filesArr.length;

        filesArr.forEach(function(filePath) {
            rpt(filePath, function(err, data) {
                if (err) {
                    throw err;
                }
                pcks.push(data);
                if (--count == 0) {
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
                    //同步上传目录至缓存目录
                    cp('-rf', path.resolve(__cache, UPLOADDIR, '*'), __cache);
                    //删除安装目录
                    rm('-rf', path.resolve(__cache, LIBNAME));
                    cb();
                }
            });
        });
    },
    /**
     * 组装模块
     * @param  {Object} dependencies 模块依赖
     * @return {void}
     */
    package: function(dependencies) {
        //project module path
        var pmp = path.resolve(__cwd, LIBNAME),
            cache = this.localCache,
            mn, tmp;
        //确保文件路径存在
        fsExtra.ensureDirSync(pmp);

        //循环同步依赖模块
        utils.traverseDependencies(dependencies, function(v, k, modulePath) {
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
    syncRemote: function(modulePath, callback) {
        if (!this.registry) {
            callback();
            return;
        }
        this.registry.put(modulePath, callback);
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
