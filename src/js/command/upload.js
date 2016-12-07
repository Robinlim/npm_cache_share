/**
* @Author: wyw.wang <wyw>
* @Date:   2016-12-07 10:12
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-12-07 10:13
*/



var fs = require('fs'),
    path = require('path'),
    fsExtra = require('fs-extra'),
    fstream = require('fstream'),
    fignore = require("fstream-ignore"),
    Factory = require('../annotation/Factory'),
    utils = require('../common/utils'),
    constant = require('../common/constant');

var __cwd = process.cwd(),
    __cache = utils.getCachePath(),
    LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    PACKAGE = 'package.json',
    npmPackagePath = path.resolve(__cwd, PACKAGE);
/*@Command({"name": "upload", "alias":"u", "des":"Upload a dir as a package to center cache server", options:[["-c, --type [type]", "server type, default is node", "node"],["-e, --repository [repository]", "specify the repository, format as HOST:PORT/REPOSITORY-NAME"],["-t, --token [token]", "use the token to access the npm_cache_share server"],["-p, --dependOnEnv", "whether the package is depend on environment meaning whether this package itself need node-gyp compile"],["-s, --alwaysSync", "mark this package to be sync on each install action"]]})*/
module.exports = {
    run: function(options){
        console.info('******************开始上传******************');
        var exit = this.exit;
        try {
            var packageInfo = fsExtra.readJsonSync(npmPackagePath);
        } catch (e) {
            exit(e);
            return;
        }
        var moduleName = packageInfo.name,
            moduleVersion = packageInfo.version,
            packageName = utils.getModuleName(moduleName, moduleVersion),
            packageNameWithEnv = utils.getModuleNameForPlatform(moduleName, moduleVersion),
            realName = options.dependOnEnv?packageNameWithEnv:packageName;
        console.info('即将上传的包名称：', realName);
        var markSyncList = !!options.alwaysSync;
        if(markSyncList){
            console.info('该包被标记为本地安装时必定从中央缓存同步最新代码状态。')
        }
        var uploadDir = path.resolve(__cache, UPLOADDIR);
        utils.ensureDirWriteablSync(uploadDir);
        var tempDir = path.resolve(uploadDir, realName);
        console.debug('temp upload path：', tempDir);
        fsExtra.emptyDirSync(tempDir);
        var source = fignore({
            path: __cwd,
            ignoreFiles: [".ignore", ".gitignore"]
        })
        .on('child', function (c) {
            console.debug('walking:',c.path.substr(c.root.path.length + 1))
        })
        .on('error', exit);
        var target = fstream.Writer(tempDir)
        .on('error', exit)
        .on('close', function(){
            console.info('开始上传模块');
            var registry = Factory.instance(options.type, options);
            registry.check([packageName], [], function(avaliable, data){
                if(avaliable){
                    if(data && data[realName]){
                        console.info('中央缓存已存在', realName, '本次上传将覆盖之前的包！');
                    }
                    registry.put(uploadDir, markSyncList, function(err){
                        exit(err);
                    });
                } else {
                    console.error('中央缓存服务不可用，无法上传！');
                }
            });
        });
        source.pipe(target);
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(err){
        if(err){
            console.error(err);
            process.exit(1);
        } else {
            console.info('******************上传结束******************');
            process.exit(0);
        }
    }
};
