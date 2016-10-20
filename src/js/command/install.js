/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-18 17:09:28
*/

'use strict'
var fs = require('fs'),
    fsExtra = require('fs-extra'),
    path = require('path');

var __cwd = process.cwd(),
    NPMSHRINKWRAP = 'npm-shrinkwrap.json',
    PACKAGE = 'package.json',
    npmShrinkwrapPath = path.resolve(__cwd, NPMSHRINKWRAP),
    npmPackagePath = path.resolve(__cwd, PACKAGE);

var installUtils = require('../common/installUtils'),
    npmUtils = require('../common/npmUtils');

/*@Flow*/
/*@Command({"name": "install [module]", "alias":"i", "des":"Install the module", options:[["-c, --type [type]", "server type, default is node", "node"],["-s, --server [server]", "specify the npm_cache_share server, like IP:PORT format"],["-e, --repository [repository]", "specify the repository, default is snapshop"],["-r, --registry [registry]", "specify the npm origin"],["-t, --token [token]", "use the token to access the npm_cache_share server"],["-a, --auth [auth]", "use auth to access the Nexus Server, like username:password format"],["-p, --production", "will not install modules listed in devDependencies"],["--noOptional", "will prevent optional dependencies from being installed"], ["--save","module will be added to the package.json as dependencies"], ["--save-dev", "module will be added to the package.json as devDependencies"]]})*/
module.exports = {
    run: function(module, options) {
        console.info('******************开始安装******************');
        this.startTime = new Date().getTime();
        this.moduleName = module;
        this.forceNpm = false;
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
        if (this.moduleName) { // 指定了模块名称则安装特定模块
            if (this.moduleName.indexOf('@') > -1) { // 包含版本号
                var arr = this.moduleName.split('@'),
                    name = arr[0],
                    version = arr[1],
                    dependencies = {};
                dependencies[name] = {
                    version: version
                };
                this.module = {
                    name: name,
                    version: version
                };
                callback(null, dependencies);
            } else { // 不含版本号则通过npm获取最新版本号
                var self = this;
                npmUtils.getLastestVersion(this.moduleName, function(err, version){
                    if (err) {
                        callback(err);
                    } else {
                        var dependencies = {};
                        dependencies[self.moduleName] = {
                            version: version
                        };
                        self.module = {
                            name: self.moduleName,
                            version: version
                        };
                        callback(null, dependencies);
                    }
                });
            }
        } else { // 未指定模块名称则全部安装
            var rs = fs.existsSync(npmShrinkwrapPath);
            if(!rs){ // 不存在npm-shrinkwrap.json，直接执行npm install
                console.warn('缺少npm-shrinkwrap.json文件，此次安装将直接使用npm install');
                this.forceNpm = true;
                callback(null);
            } else { // 存在npm-shrinkwrap.json则分析其依赖进行安装
                console.info('读取npm-shrinkwrap.json文件！！');
                try{
                    callback(null, fsExtra.readJsonSync(npmShrinkwrapPath).dependencies);
                }catch(e){
                    console.error(e.stack);
                    callback(e);
                }
            }
        }
    },
    /**
     * 分析依赖并安装
     * @return {[type]} [description]
     */
    /*@Step("preinstall")*/
    install: function(rs, callback){
        var dependencies = rs.preinstall;
        if (this.forceNpm) {
            npmUtils.npmInstall(this.opts, callback);
        } else {
            installUtils.parse(dependencies, this.opts, callback, this.module);
        }
    },
    /*@Step("install")*/
    postinstall: function(rs, callback){
        // 安装特定模块并指定了--save/--save-dev时写入package.json
        if(this.module && (this.opts['save'] || this.opts['saveDev'])){
            try {
                var packageInfo = fsExtra.readJsonSync(npmPackagePath);
            } catch (e) {
                callback(e);
                return;
            }
            var dependenceKey = this.opts['save'] ? 'dependencies' : 'devDependencies';
            if(!packageInfo[dependenceKey]){
                packageInfo[dependenceKey] = {};
            }
            packageInfo[dependenceKey][this.module.name] = this.module.version;
            try {
                fsExtra.writeJson(npmPackagePath, packageInfo);
            } catch (e) {
                callback(e);
                return;
            }
        }
        // 安装特定模块或者直接使用npm安装后重新npm-shrinkwrap
        if(this.module || this.forceNpm){
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
