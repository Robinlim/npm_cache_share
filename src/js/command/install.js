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
    npmShrinkwrapPath = path.resolve(__cwd, NPMSHRINKWRAP);

var installUtils = require('../common/installUtils');

/*@Flow*/
/*@Command({"name": "install [module]", "alias":"i", "des":"Install the module", options:[["-c, --type [type]", "server type, default is node", "node"],["-s, --server [server]", "specify the npm_cache_share server, like IP:PORT format"],["-d, --repository [repository]", "specify the repository, default is snapshop"],["-r, --registry [registry]", "specify the npm origin"],["-t, --token [token]", "use the token to access the npm_cache_share server"],["-a, --auth [auth]", "use auth to access the Nexus Server, like username:password format"],["-p, --production", "will not install modules listed in devDependencies"],["--noOptional", "will prevent optional dependencies from being installed"], ["--save","module will be added to the package.json as dependencies"], ["--save-dev", "module will be added to the package.json as devDependencies"]]})*/
module.exports = {
    run: function(module, options) {
        console.info('******************开始安装******************');
        this.module = module;
        this.opts = options;
        this.start();
    },
    /**
     * 由于主要依赖npm-shrinkwrap.json来处理依赖，故须检测该文件
     * @return {[boolean]}
     */
    /*@Step*/
    check: function(callback){
        var rs = fs.existsSync(npmShrinkwrapPath);
        if(!rs){
            var err = '缺少npm-shrinkwrap.json文件\n请在本地环境执行npm shrinkwrap指令来生成npm-shrinkwrap.json文件，上传至git库中!!';
            callback(err);
            return;
        }
        callback(null, true);
    },
    /**
     * 解析npm-shrinkwrap.json文件
     * @return {[type]} [description]
     */
    /*@Step("check")*/
    parse: function(rs, callback){
        try{
            console.info('读取npm-shrinkwrap.json文件！！');
            callback(null, fsExtra.readJsonSync(npmShrinkwrapPath).dependencies);
        }catch(e){
            console.error(e.stack);
            callback(e);
        }
    },
    /**
     * 分析依赖
     * @return {[type]} [description]
     */
    /*@Step("parse")*/
    analyseDependency: function(rs, callback){
        if(!rs){
            callback('没有依赖！');
            return;
        }
        installUtils.parse(rs.parse, this.opts, callback, this.module);
    },
    /*@Done*/
    done: function(err, results){
        if(err){
            console.error(err);
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
        console.info('******************安装结束******************');
        process.exit(code);
    }
}
