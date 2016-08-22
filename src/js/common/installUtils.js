/**
 * @Author: robin
 * @Date:   2016-08-08 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-22 19:50:51
 */

'use strict'
var path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    request = require('request'),
    targz = require('tar.gz'),
    _ = require('lodash');

require('shelljs/global');

var utils = require('./utils');

var LIBNAME = 'node_modules',
    SPLIT = '@@@',
    fileExt = '.tar.gz',
    __cwd = process.cwd(),
    __cache = utils.getCachePath();

var arch = process.arch,
    platform = process.platform,
    v8 = /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];

module.exports = {
    /**
     * 分析依赖
     * @param  {[type]} dependencies [description]
     * @param  {[type]} opts         [description]
     * @return {[type]}              [description]
     */
    parse: function(dependencies, opts) {
        this.opts = utils.toString(opts);
        console.info(this.opts);
        this.server = opts.server;
        //确保文件夹存在
        fsExtra.ensureDirSync(__cache);

        console.info('开始解析');
        this.checkServer(_.bind(function(){
            this.parseModule(dependencies);
        }, this));
    },
    /*@Async*/
    parseModule: function(dependencies){
        //解析模块依赖
        _.each(dependencies, _.bind(function(v, k) {
            console.info('检测' + [k, v.version].join('@'));
            this.fetchModule(k, v.version, v.dependencies).await();
            this.package(k, v.version, v.dependencies).await();
        }, this));

        //需要将新的模块同步到远程服务
        this.syncRemote(path.resolve(__cache, LIBNAME), function() {
            //删除缓存的node_modules目录
            console.info('删除临时目录');
            rm('-rf', path.resolve(__cache, LIBNAME));
        });
    },
    /**
     * 获取模块
     * @param  {[type]} name            [description]
     * @param  {[type]} version         [description]
     * @param  {[type]} dependencies    [description]
     * @return {[type]}                 [description]
     */
    /*@Async*/
    fetchModule: function(name, version, dependencies) {
        var npmModule = this.getModuleName(name, version, dependencies),
            cacheModulePath = this.fromCache(npmModule);

        //如果模块不存在，尝试使用与系统相关版本
        if (!cacheModulePath) {
            cacheModulePath = this.fromCache(this.getModuleNameForPlatform(name, version));
        }

        if (!cacheModulePath && this.serverReady()) {
            cacheModulePath = this.fromRemoteToCache(npmModule, this.getModuleNameForPlatform(name, version)).await();
        }
        if (!cacheModulePath) {
            this.install(name, version, npmModule);
        }
    },
    /**
     * 组装模块
     * @param  {[type]} name         [description]
     * @param  {[type]} version      [description]
     * @param  {[type]} dependencies [description]
     * @param  {[type]} modulePath   [description]
     * @return {[type]}              [description]
     */
    /*@Async*/
    package: function(name, version, dependencies, modulePath) {
        var moduleName = [name, version].join('@');
        modulePath = modulePath || path.resolve(__cwd, LIBNAME);
        fsExtra.ensureDirSync(modulePath);

        var oriModulePath = path.resolve(__cache, this.getModuleName(name, version, dependencies));
        console.info('开始打包模块' + moduleName);
        if (!test('-d', oriModulePath)) {
            //尝试获取与系统相关版本
            var moduleNameForPlatform = this.getModuleNameForPlatform(name, version),
                oriModulePathForPlatform = path.resolve(__cache, moduleNameForPlatform);

            if (!test('-d', oriModulePathForPlatform)) {
                this.fetchModule(name, version, dependencies).await();
            } else {
                oriModulePath = oriModulePathForPlatform;
            }
        }
        var target = path.resolve(modulePath, name);
        fsExtra.ensureDirSync(target);
        if(test('-d', oriModulePath)){
            cp('-rf', oriModulePath + path.sep + '*', target);
        }
        dependencies && _.each(dependencies, _.bind(function(v, k) {
            this.package(k, v.version, v.dependencies, path.resolve(modulePath, name, LIBNAME)).await();
        }, this));
    },
    /**
     * 从本地缓存中读取
     * @param  {[type]} npmModule [description]
     * @return {[type]}           [description]
     */
    fromCache: function(npmModule) {
        npmModule = path.resolve(__cache, npmModule);
        return fs.existsSync(npmModule) && npmModule;
    },
    /**
     * 从远端服务中读取
     * @return {[type]} [description]
     */
    /*@AsyncWrap*/
    fromRemoteToCache: function(moduleName, moduleNameForPlatform, cb) {
        request
            .get(['http:/', this.server, 'fetch', moduleName, moduleNameForPlatform].join('/'))
            .on('response', function(response) {
                if (response.statusCode == 200) {
                    var target = path.resolve(__cache, response.headers.modulename + fileExt);
                    response.pipe(fs.createWriteStream(target));
                    targz().extract(target, __cache, function(err) {
                        rm('-f', target);
                        if (err){
                            console.error( target + ' extract is wrong ', err.stack);
                            cb(null, false);
                            return;
                        }
                        console.info(target + ' extract done!');
                        cb(null, fs.existsSync(target) && target);
                    });
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
     * @return {[type]} [description]
     */
    install: function(name, version, npmModule) {
        //抵达缓存目录
        cd(__cache);

        //执行安装
        fsExtra.ensureDirSync(path.resolve(__cache, LIBNAME));
        var npmName = [name, version].join('@');
        console.info('安装' + npmName);
        if (exec('npm install ' + npmName + ' ' + this.opts).code !== 0) {
            throw npmName + ' install failed, please try by yourself!!';
        }
        //递归依赖，从里往外进行迁移
        this.traverseModule(__cache, _.bind(function(modulePath) {
            var packagePath = path.resolve(modulePath, 'package.json');
            if (!test('-f', packagePath)) {
                return;
            }
            var des = fsExtra.readJsonSync(packagePath);
            if(test('-f', modulePath)){
                cp('-rf', modulePath, path.resolve(__cache, LIBNAME, this.getModuleName(des.name, des.version, des.dependencies, modulePath)));
                rm('-rf', modulePath);
            }
        }, this));
        //同步模块到缓存中
        if(!test('-f', path.resolve(__cache, LIBNAME))){
            cp('-rf', path.resolve(__cache, LIBNAME) + path.sep + '*', __cache);
        }
    },
    /**
     * 同步远程服务
     * @param  {[type]}   modulePath [description]
     * @param  {Function} callback   [description]
     * @return {[type]}              [description]
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
        targz().compress(modulePath, target, function(err) {
            if (err) {
                console.error('compress wrong ', err.stack);
                callback();
                return;
            }
            console.info('compress done!');
            upload();
        });

        function upload() {
            console.info('同步模块至服务http://' + server);
            request.post({
                url: 'http://' + server + '/upload',
                formData: {
                    modules: fs.createReadStream(target)
                }
            }, function(err) {
                rm('-f', target);
                callback();
                if (err) {
                    console.error('上传失败:', err);
                    return;
                }
                console.info('上传成功');
            });
        }
    },
    /**
     * 深度遍历模块依赖
     * @param  {[type]}   curPath  [description]
     * @param  {Function} callback [description]
     * @param  {[type]}   name     [description]
     * @return {[type]}            [description]
     */
    traverseModule: function(curPath, callback, name) {
        if (!(name && name.indexOf('@') == 0)) {
            curPath = path.resolve(curPath, LIBNAME);
        }
        if (!test('-d', curPath)) {
            return;
        }
        ls(curPath).forEach(_.bind(function(file) {
            this.traverseModule(path.resolve(curPath, file), callback, file);
            callback(path.resolve(curPath, file));
        }, this));
    },
    /**
     * 生成和环境相关的名称
     * @param  {[type]} name    [description]
     * @param  {[type]} version [description]
     * @return {[type]}         [description]
     */
    getModuleNameForPlatform: function(name, version) {
        return [name, version, platform + '-' + arch + '-v8-' + v8].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 生成带版本的模块名
     * @param  {[type]} name         [description]
     * @param  {[type]} version      [description]
     * @param  {[type]} dependencies [description]
     * @return {[type]}              [description]
     */
    getModuleName: function(name, version, dependencies, modulePath) {
        //for <= node v0.8 use node-waf to build native programe with wscript file
        //for > node v0.8 use node-gyp to build with binding.gyp
        //see also: https://www.npmjs.com/package/node-gyp
        if ((dependencies && dependencies['node-gyp']) ||
            (modulePath && (test('-d', path.resolve(modulePath, 'binding.gyp')) || test('-d', path.resolve(modulePath, 'wscript'))))) {
            return this.getModuleNameForPlatform(name, version);
        }
        return [name, version].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 判断服务是否正常
     * @return {[type]} [description]
     */
    checkServer: function(cb) {
        if (!this.server){
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
