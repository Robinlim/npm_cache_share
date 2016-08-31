/**
 * @Author: robin
 * @Date:   2016-08-08 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-29 13:33:19
 */

'use strict'
var path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    request = require('request'),
    tar = require('tar'),
    _ = require('lodash');

require('shelljs/global');

var utils = require('./utils');

var LIBNAME = 'node_modules',
    UPLOADDIR = 'upload_dir',
    SPLIT = '@@@',
    fileExt = '.tar',
    __cwd = process.cwd(),
    __cache = utils.getCachePath(),
    cache = {};

var arch = process.arch,
    platform = process.platform,
    v8 = /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];

module.exports = {
    /**
     * 分析依赖
     * @param  {Object} dependencies 模块依赖
     * @param  {Object} opts         指令参数
     * @param  {Function} callback     回调
     * @return {void}
     */
    parse: function(dependencies, opts, callback) {
        //参数处理
        if (opts.noOptional) {
            delete opts.noOptional;
            opts["no-optional"] = true;
        }
        this.server = opts.service;
        delete opts.service;
        //构建安装参数
        this.opts = utils.toString(opts);
        //确保文件夹存在并可写入
        utils.ensureDirWriteablSync(__cache);
        utils.ensureDirWriteablSync(path.resolve(__cwd, LIBNAME));

        console.info('开始解析');
        //判断公共缓存是否存在
        this.checkServer(_.bind(function() {
            this.parseModule(dependencies, callback);
        }, this));
    },
    /**
     * 解析模块
     * @param  {Object}   dependencies 模块依赖
     * @param  {Function} callback     回调
     * @return {void}
     */
     /*@Async*/
    parseModule: function(dependencies, callback) {
        //解析模块依赖
        _.each(dependencies, _.bind(function(v, k) {
            console.info('检测' + [k, v.version].join('@'));
            //安装模块
            this.fetchModule(k, v.version, v.dependencies).await();
            //同步打包
            this.package(k, v.version, v.dependencies).await();
        }, this));

        //需要将新的模块同步到远程服务
        this.syncRemote(path.resolve(__cache, UPLOADDIR), function() {
            //删除缓存的node_modules目录
            console.info('删除临时目录');
            rm('-rf', path.resolve(__cache, LIBNAME));
            callback();
        });
    },
    /**
     * 获取模块
     * @param  {String} name            模块名称
     * @param  {String} version         模块版本
     * @param  {Object} dependencies    模块依赖
     * @return {void}
     */
    /*@Async*/
    fetchModule: function(name, version, dependencies) {
        var npmModule = this.getModuleName(name, version, dependencies),
            cacheModulePath = this.fromCache(npmModule);

        //如果模块不存在，尝试使用与系统相关版本
        if (!cacheModulePath) {
            cacheModulePath = this.fromCache(this.getModuleNameForPlatform(name, version));
        }
        //如果本地不存在，尝试从公共服务缓存中获取
        if (!cacheModulePath && this.serverReady()) {
            cacheModulePath = this.fromRemoteToCache(npmModule, this.getModuleNameForPlatform(name, version)).await();
        }
        //本地和服务端都不存在，则安装该模块
        if (!cacheModulePath) {
            this.install(name, version);
        }
    },
    /**
     * 组装模块
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @param  {Object} dependencies 模块依赖
     * @param  {String} modulePath   模块当前路径
     * @return {void}
     */
    /*@Async*/
    package: function(name, version, dependencies, modulePath) {
        var moduleName = [name, version].join('@');
        modulePath = modulePath || path.resolve(__cwd, LIBNAME);
        //确保文件路径存在
        fsExtra.ensureDirSync(modulePath);

        var oriModulePath = path.resolve(__cache, this.getModuleName(name, version, dependencies));
        console.info('开始打包模块' + moduleName);
        //判断模块是否存在，不存在则尝试获取或安装模块
        if (!test('-d', oriModulePath)) {
            //是否存在系统相关版本
            var moduleNameForPlatform = this.getModuleNameForPlatform(name, version),
                oriModulePathForPlatform = path.resolve(__cache, moduleNameForPlatform);

            if (!test('-d', oriModulePathForPlatform)) {
                this.fetchModule(name, version, dependencies).await();
            } else {
                oriModulePath = oriModulePathForPlatform;
            }
        }
        //同步模块至项目工程
        var target = path.resolve(modulePath, name);
        fsExtra.ensureDirSync(target);
        if (test('-d', oriModulePath)) {
            cp('-rf', oriModulePath + path.sep + '*', target);
        }
        //循环同步依赖模块
        dependencies && _.each(dependencies, _.bind(function(v, k) {
            this.package(k, v.version, v.dependencies, path.resolve(modulePath, name, LIBNAME)).await();
        }, this));
    },
    /**
     * 从本地缓存中读取
     * @param  {String} npmModule 模块唯一名称，一般为名称+版本+[系统版本]
     * @return {Boolean}        存在为true, 否则为false
     */
    fromCache: function(npmModule) {
        npmModule = path.resolve(__cache, npmModule);
        return fs.existsSync(npmModule) && npmModule;
    },
    /**
    * 从远端服务中读取
    * @param  {String}   moduleName            模块唯一名称
    * @param  {String}   moduleNameForPlatform 模块与系统相关唯一名称
    * @param  {Function} cb                    回调
    * @return {[void]}
    */
    /*@AsyncWrap*/
    fromRemoteToCache: function(moduleName, moduleNameForPlatform, cb) {
        request
            .get(['http:/', this.server, 'fetch', moduleName, moduleNameForPlatform].join('/'))
            .on('response', function(response) {
                if (response.statusCode == 200) {
                    // 获取文件名称
                    var target = path.resolve(__cache, response.headers.modulename + fileExt);
                    // 解压文件操作
                    var extractor = tar.Extract({
                            path: __cache
                        })
                        .on('error', function(err){
                            console.error(target + ' extract is wrong ', err.stack);
                            cb(null, false);
                        })
                        .on('end', function(){
                            console.info(target + ' extract done!');
                            target = path.resolve(__cache, response.headers.modulename);
                            cb(null, fs.existsSync(target) && target);
                        });
                    // 请求返回流通过管道流入解压流
                    response.pipe(extractor);
                    return;
                }
                cb(null, false);
            })
            .on('error', function(err) {
                cb(null, false);
                console.error(err);
            });
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

        //执行安装
        utils.ensureDirWriteablSync(path.resolve(__cache, LIBNAME));
        var npmName = [name, version].join('@');
        console.info('安装' + npmName);
        if (exec('npm install ' + npmName + ' ' + this.opts).code !== 0) {
            throw npmName + ' install failed, please try by yourself!!';
        }
        //递归依赖，层次扁平化
        var packagePath, moduleTmp;
        this.traverseModule(__cache, _.bind(function(modulePath, top) {
            //文件名＋版本号
            packagePath = path.resolve(modulePath, 'package.json');
            if (!test('-f', packagePath)) {
                return;
            }
            var des = fsExtra.readJsonSync(packagePath);
            if (test('-d', modulePath)) {
                moduleTmp = path.resolve(__cache, UPLOADDIR, this.getModuleName(des.name, des.version, des.dependencies, modulePath));
                //创建目录
                fsExtra.ensureDirSync(moduleTmp);
                modulePath != moduleTmp && cp('-rf', modulePath + path.sep + '*', moduleTmp);
                !top && rm('-rf', modulePath);
            }
        }, this), null, true);
        //同步模块到缓存中
        moduleTmp = path.resolve(__cache, UPLOADDIR);
        if (test('-d', moduleTmp)  && ls(moduleTmp).length > 0) {
            cp('-rf', moduleTmp + path.sep + '*', __cache);
        }
    },
    /**
     * 同步远程服务
     * @param  {String}   modulePath 模块路径
     * @param  {Function} callback   回调
     * @return {void}
     */
    syncRemote: function(modulePath, callback) {
        if (!this.serverReady() || !fs.existsSync(modulePath)) {
            callback();
            return;
        }
        var target = path.resolve(__cache, Date.now() + fileExt),
            server = this.server;
        console.info('开始压缩需要上传模块');
        // compress
       utils.compress(modulePath, target, function(err) {
           if (err) {
               console.error('compress wrong ', err.stack);
               callback();
               return;
           }
           console.info('同步模块至服务http://' + server);
           request.post({
               url: 'http://' + server + '/upload',
               formData: {
                   modules: fs.createReadStream(target)
               }
           }, function(err) {
               rm('-f', target);
               if (err) {
                   console.error('上传失败:', err);
                   callback();
                   return;
               }
               console.info('上传成功');
               callback();
           });
       });
    },
    /**
     * 深度遍历模块依赖
     * @param  {String}   curPath  当前路径
     * @param  {Function} callback 回调
     * @param  {String}   name     文件夹名称
     * @param  {Boolean}   top     是否为第一级目录
     * @return {void}
     */
    traverseModule: function(curPath, callback, name, top) {
        if (!(name && name.indexOf('@') == 0)) {
            curPath = path.resolve(curPath, LIBNAME);
        }
        if (!test('-d', curPath)) {
            return;
        }

        ls(curPath).forEach(_.bind(function(file) {
            this.traverseModule(path.resolve(curPath, file), callback, file);
            callback(path.resolve(curPath, file), top);
        }, this));
    },
    /**
     * 生成和环境相关的名称
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @return {String}
     */
    getModuleNameForPlatform: function(name, version) {
        return [name, version, platform + '-' + arch + '-v8-' + v8].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 生成带版本的模块名
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @param  {Object} dependencies 模块依赖
     * @return {String}
     */
    getModuleName: function(name, version, dependencies, modulePath) {
        //for <= node v0.8 use node-waf to build native programe with wscript file
        //for > node v0.8 use node-gyp to build with binding.gyp
        //see also: https://www.npmjs.com/package/node-gyp
        if ((dependencies && dependencies['node-gyp']) ||
            (modulePath && (test('-f', path.resolve(modulePath, 'binding.gyp')) || test('-f', path.resolve(modulePath, 'wscript'))))) {
            return this.getModuleNameForPlatform(name, version);
        }
        return [name, version].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 判断服务是否正常
     * @return {[type]} [description]
     */
    checkServer: function(cb) {
        if (!this.server) {
            cb();
            return;
        }
        request
            .get('http://' + this.server + '/healthcheck.html')
            .on('response', _.bind(function() {
                cb(this.serverHealth = true);
            }, this))
            .on('error', _.bind(function(err) {
                console.error(this.server + '该服务不可正常访问，请检查服务！');
                cb(this.serverHealth = false);
            }, this));
    },
    /**
     * 判断服务是否正常
     * @return {[type]} [description]
     */
    serverReady: function() {
        if (!this.server) return false;
        if (this.serverHealth) return true;
        if (this.serverHealth === false) return false;
        return false;
    },
    /**
     * 获得缓存路径
     * @return {[type]} [description]
     */
    getCachePath: function() {
        return __cache;
    }
};
