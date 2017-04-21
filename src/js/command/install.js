/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-18 17:09:28
*/

'use strict'
var _ = require('lodash'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    path = require('path'),
    constant = require('../common/constant'),
    Factory = require('../annotation/Factory');

var __cwd = process.cwd(),
    PACKAGE = 'package.json',
    npmPackagePath = path.resolve(__cwd, PACKAGE);

var utils = require('../common/utils'),
    installUtils = require('../common/installUtils'),
    npmUtils = require('../common/npmUtils'),
    manifestUtils = require('../common/manifestUtils');

/*@Flow*/
/*@Command({
    "name": "install [module]",
    "alias":"i",
    "des":"Install the module",
    options:[
        ["-c, --type [type]", "server type, default is node", "node"],
        ["-e, --repository [repository]", "specify the repository, format as HOST:PORT/REPOSITORY-NAME"],
        ["-r, --registry [registry]", "specify the npm origin"],
        ["-t, --token [token]", "use the token to access the npm_cache_share server"],
        ["-a, --auth [auth]", "use auth to access the Nexus Server, like username:password format"],
        ["-p, --production", "will not install modules listed in devDependencies"],
        ["-n, --npm [npm]", "specify the npm path to execute", "npm"],
        ["-l, --lockfile [lockfile]", "specify the filename of lockfile,default npm-shrinkwrap.json"],
        ["--noOptional", "will prevent optional dependencies from being installed"],
        ["--save", "module will be added to the package.json as dependencies, default true"],
        ["--nosave", "do not save package to package.json"],
        ["--save-dev", "module will be added to the package.json as devDependencies"]
    ]
})*/
module.exports = {
    run: function(module, options) {
        console.info('******************开始安装******************');
        this.startTime = new Date().getTime();
        this.moduleName = module;
        this.forceNpm = false;
        this.registry = Factory.instance(options.type, options);
        this.opts = options;
        if(options.installTimeout){
            console.debug('安装超时时间：',options.installTimeout,'s');
            setTimeout(function(){
                console.error('安装超时，自动退出！当前设置的超时时间为',
                 options.installTimeout, 's,如需更改，请使用npm_cache_share config set installTimeout XXX 修正。');
                process.exit(1);
            }, options.installTimeout*1000);
        }
        this.start();
    },
    /**
     * 安装前分析，回调传入dependencies
     * @return {[boolean]}
     */
    /*@Step*/
    preinstall: function(callback){
        //指定npm路径
        this.opts.npm && npmUtils.config(this.opts.npm);
        var self = this;
        if (self.moduleName) { // 指定了模块名称则安装特定模块
            var name = utils.splitModuleName(self.moduleName),
                version = utils.splitModuleVersion(self.moduleName),
                dependencies = {};
            self.registry.info(name, version, function(err, data){
                console.debug('info', name, version, err, data);
                if(!err && data.full){
                    dependencies[name] = {
                        version: data.version
                    };
                    self.module = {
                        name: data.name,
                        version: data.version,
                        isPrivate: data.isPrivate,
                        full: data.full,
                        url: data.url
                    };
                    callback(null, dependencies);
                } else {
                    if(!version){
                        npmUtils.getLastestVersion(self.moduleName, function(err, latestVersion){
                            if (err) {
                                callback(err);
                            } else {
                                dependencies[name] = {
                                    version: latestVersion
                                };
                                self.module = {
                                    name: name,
                                    version: latestVersion
                                };
                                callback(null, dependencies);
                            }
                        });
                    } else {
                        dependencies[name] = {
                            version: version
                        };
                        self.module = {
                            name: name,
                            version: version
                        };
                        callback(null, dependencies);
                    }
                }
            });
        } else { // 未指定模块名称则全部安装
            manifestUtils.readManifest(__cwd, this.opts.lockfile, callback);
        }
    },
    /**
     * 分析依赖并安装
     * @return {[type]} [description]
     */
    /*@Step("preinstall")*/
    install: function(rs, callback){
        var self = this,
            dependencies = rs.preinstall;
        // 未取得依赖信息时强制采用npm安装
        if(!dependencies){
            this.forceNpm = true;
        }
        if (this.forceNpm) {
            npmUtils.npmInstall(this.opts, {}, callback);
        } else {
            // 安装指定模块以及其子依赖
            if(this.module){
                installUtils.parse(__cwd, this.registry, dependencies, this.opts, function(err0, val){
                    if(err0){
                        callback(err0);
                    } else {//if(val.installNum === 0) { //如果模块是从缓存加载的，则安装其子依赖
                        console.info('安装'+self.module.name+'的子依赖');
                        var childrenPath = path.resolve(__cwd, constant.LIBNAME, self.module.name);
                        console.debug('模块路径：',childrenPath)
                        manifestUtils.readManifest(childrenPath, null, function(err1, children){
                            if(err1){
                                callback(err1);
                            } else {
                                if(children){
                                    installUtils.parse(childrenPath, self.registry, children, self.opts, callback);
                                } else {
                                    // 子模块默认指定--prodcution
                                    var opts = _.extend({
                                        production: true
                                    }, self.opts);
                                    npmUtils.npmInstall(opts, {
                                        cwd: childrenPath
                                    }, callback);
                                }
                            }
                        });
                    }
                });
            } else {
                installUtils.parse(__cwd, this.registry, dependencies, this.opts, callback);
            }
        }
    },
    /*@Step("install")*/
    postinstall: function(rs, callback){
        // 安装特定模块并指定了--save/--save-dev时写入package.json
        if(this.module){
            if(this.opts['save']){
                console.info('我们默认会自动save，所以你无需追加--save字段，如果想取消自动的--save，请使用--nosave');
            }
            if(!this.opts['nosave'] || this.opts['saveDev']){
                try {
                    var packageInfo = fsExtra.readJsonSync(npmPackagePath);
                } catch (e) {
                    callback(e);
                    return;
                }
                var dependenceKey = this.opts['saveDev'] ? 'devDependencies' : 'dependencies';
                if(!packageInfo[dependenceKey]){
                    packageInfo[dependenceKey] = {};
                }
                packageInfo[dependenceKey][this.module.name] = this.module.isPrivate?
                    this.module.url : this.module.version;
                try {
                    fsExtra.writeJsonSync(npmPackagePath, packageInfo);
                } catch (e) {
                    callback(e);
                    return;
                }
                npmUtils.npmPrune();
                // 安装特定模块后重新npm-shrinkwrap
                npmUtils.npmShrinkwrap(callback);
            } else {
                console.warn('安装该模块未开启save，将不会更新package.json和npm-shrinkwrap.json!!!');
                callback(null);
            }
        } else if(this.forceNpm){ // 直接使用npm安装后重新npm-shrinkwrap
            npmUtils.npmShrinkwrap(callback);
        } else {
            callback(null);
        }
    },
    /*@Done*/
    done: function(err, results){
        if(err){
            console.error(err.stack || err);
            this.exit(1);
            return;
        }
        this.exit(0);
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(code){
        var endTime = new Date().getTime();
        console.info('总共耗时：', parseInt((endTime - this.startTime)/1000), 's');
        console.info('******************安装结束******************');
        process.exit(code);
    }
}
