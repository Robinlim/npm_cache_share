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
    checkUtils = require('../common/checkUtils'),
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
        ["-n, --npm [npm]", "specify the npm path to execute"],
        ["-f, --forcenpm", "will use npm to install modules, event when yarn exists"],
        ["-l, --lockfile [lockfile]", "specify the filename of lockfile,default npm-shrinkwrap.json"],
        ["--ignoreBlackList", "ignore black list"],
        ["--disturl [disturl]", "node mirror for node-gyp build"],
        ["--checkSnapshotDeps", "check if or not dependend on the snapshot module, default is ignore check"],
        ["--noOptional", "will prevent optional dependencies from being installed"],
        ["--save", "module will be added to the package.json as dependencies, default true"],
        ["--nosave", "do not save package to package.json"],
        ["--save-dev", "module will be added to the package.json as devDependencies"]
    ]
})*/
module.exports = {
    run: function(module, options) {
        console.info('当前版本为: 1.1.9');
        console.info('******************开始安装******************');
        this.startTime = new Date().getTime();
        this.moduleName = module;
        this.forceNpm = false;
        this.registry = Factory.instance(options.type, options);
        this.opts = options;
        if(options.forcenpm){
            npmUtils.checkYarn = false;
        }
        //安装超时处理
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
        npmUtils.config(this.opts.npm);
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
                                    version: latestVersion,
                                    isPrivate: data.isPrivate
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
                            version: version,
                            isPrivate: data.isPrivate
                        };
                        callback(null, dependencies);
                    }
                }
            });
        } else { // 未指定模块名称则全部安装
            //清空工程目录里的node_modules
            fsExtra.emptyDirSync(path.resolve(__cwd, constant.LIBNAME));
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
        }else if(this.opts.checkSnapshotDeps){
            checkUtils.snapshotDepsCheck(dependencies);
        }
        if (this.forceNpm) {
            npmUtils.npmInstall(this.opts, {}, callback);
        } else {
            // 安装指定模块以及其子依赖
            if(this.module){
                installUtils.parse(__cwd, this.registry, dependencies, this.opts, function(err0, val){
                    if(err0){
                        callback(err0);
                    } else {
                        //如果模块是从缓存加载的，则安装其子依赖
                        var instModule = self.module,
                            childrenPath = path.resolve(__cwd, constant.LIBNAME, instModule.name),
                            packageInfo = fsExtra.readJsonSync(path.resolve(childrenPath, PACKAGE));
                        //不加_requested的值会导致npm shrinkwrap失败，仅针对SNAPSHOT版本没有进行发布到npm源上需要增加的
                        if(utils.isSnapshot(instModule.full)){
                            console.info('处理模块' + instModule.name + '的package.json');
                            packageInfo['_requested'] = { rawSpec: instModule.url };
                            packageInfo['_resolved'] = instModule.url;
                            try {
                                fsExtra.writeJsonSync(path.resolve(childrenPath, PACKAGE), packageInfo);
                            } catch (e) {
                                callback(e);
                                return;
                            }
                        }
                        if(_.isEmpty(packageInfo.dependencies)){
                            console.info('没有子依赖');
                            callback();
                            return;
                        }
                        console.info('安装' + instModule.name + '的子依赖');
                        console.debug('模块路径：',childrenPath);

                        manifestUtils.readManifest(childrenPath, null, function(err1, children){
                            if(err1){
                                callback(err1);
                            } else {
                                if(children){
                                    installUtils.parse(childrenPath, self.registry, children, self.opts, callback);
                                } else {
                                    //提前创建node_modules文件，避免npm install向上级目录查找
                                    utils.ensureDirWriteablSync(path.resolve(childrenPath, constant.LIBNAME));
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
        var opts = this.opts;
        // 安装特定模块并指定了--save/--save-dev时写入package.json
        if(this.module){
            if(opts['save']){
                console.info('我们默认会自动save，所以你无需追加--save字段，如果想取消自动的--save，请使用--nosave');
            }
            if(!opts['nosave'] || opts['saveDev']){
                var packageInfo;
                //获取package.json
                if(fs.existsSync(npmPackagePath)){
                    packageInfo = fsExtra.readJsonSync(npmPackagePath);
                }
                if(!packageInfo){
                    callback('package.json not exist!!!');
                    return;
                }
                var dependenceKey = opts['saveDev'] ? 'devDependencies' : 'dependencies';
                if(!packageInfo[dependenceKey]){
                    packageInfo[dependenceKey] = {};
                }
                //在本地安装私有模块SNAPSHOT版本时，会记录其开发环境的链接，而测试环境也就会复用这个开发环境的链接版本
                // packageInfo[dependenceKey][this.module.name.replace(constant.SPLIT, '/')] = this.module.isPrivate?
                    // this.module.url : this.module.version;
                packageInfo[dependenceKey][this.module.name.replace(constant.SPLIT, '/')] = this.module.version;
                try {
                    fsExtra.writeJsonSync(npmPackagePath, packageInfo);
                } catch (e) {
                    callback(e);
                    return;
                }
                // 安装snapshot版本清除时会失败
                // npmUtils.npmPrune(opts);
                // 安装特定模块后重新npm-shrinkwrap
                npmUtils.npmShrinkwrap(opts, callback);
            } else {
                console.warn('安装该模块未开启save，将不会更新package.json和npm-shrinkwrap.json!!!');
                callback(null);
            }
        } else if(this.forceNpm){ // 直接使用npm安装后重新npm-shrinkwrap
            npmUtils.npmShrinkwrap(opts, callback);
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
        console.info('******************安装' + (code == 1 ? '失败' : '成功') +'******************');
        process.exit(code);
    }
}
