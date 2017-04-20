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
    fignore = require('fstream-ignore'),
    Factory = require('../annotation/Factory'),
    utils = require('../common/utils'),
    npmUtils = require('../common/npmUtils'),
    shellUtils = require('../common/shellUtils'),
    f2bConfigUtils = require('../common/f2bConfigUtils'),
    constant = require('../common/constant');

var __cwd = process.cwd(),
    __cache = utils.getCachePath(),
    LIBNAME = constant.LIBNAME,
    UPLOADDIR = constant.UPLOADDIR,
    PACKAGE = 'package.json',
    npmPackagePath = path.resolve(__cwd, PACKAGE);
/*@Command({
    "name": "publish",
    "alias":"p",
    "des":"Publish a dir as a package to center cache server，only for node type",
    options:[
        ["-c, --type [type]", "server type node/npm, default is node", "node"],
        ["-e, --repository [repository]", "specify the repository, format as HOST:PORT/REPOSITORY-NAME"],
        ["-t, --token [token]", "use the token to access the npm_cache_share server"],
        ["-p, --password [password]", "use the password to access certain package"],
        ["-b, --dependOnEnv", "whether the package is depend on environment meaning whether this package itself need node-gyp compile"],
        ["-r, --registry [registry]", "specify the npm registry"],
        ["-s, --snapshot", "specify this is a snapshot version"],
        ["-u, --alwaysUpdate", "this module will publish overwrite the same version on the server, and will always update when install, if -s not specify, the version remain unchanged"],
        ["-o, --overwrite", "if -s exist, it will overwrite the version into package.json"]
    ]
})*/

module.exports = {
    run: function(options){
        console.info('******************开始发布******************');
        var type = options.type;
        if(type === 'node'){
            console.info('将发布到中央缓存');
            this.toNode(options);
        } else if (type === 'npm'){
            console.info('将发布到npm');
            this.toNpm(options);
        } else {
            this.exit(new Error('不支持的发布类型：'+type+',请指定--type为node或npm'));
        }
    },
    /**
     * 发布到node中央缓存
     * @param  {object} options 输入参数
     * @return {[type]}         [description]
     */
    toNode: function(options){
        var exit = this.exit;
        try {
            var packageInfo = fsExtra.readJsonSync(npmPackagePath);
        } catch (e) {
            exit(e);
            return;
        }

        //校验工程命名
        var moduleName = packageInfo.name;
        f2bConfigUtils.checkName(moduleName, options.nameReg);

        var moduleVersion = packageInfo.version;
        if(utils.isSnapshot(moduleVersion)){
            options.snapshot = true;
        }else if(options.snapshot){
            moduleVersion += (options.SNAPSHOTLINK || '-') + constant.VERSION_TYPE.SNAPSHOT;
        }

        if(options.snapshot){
            console.info('将发布SNAPSHOT版本，每次发布都会覆盖现有同名版本。');
        }else if(options.alwaysUpdate){
            console.info('设定该模块每次发布都会覆盖现有同名版本，并且安装时都会拉取最新。');
        }

        var packageName = utils.getModuleName(moduleName, moduleVersion),
            packageNameWithEnv = utils.getModuleNameForPlatform(moduleName, moduleVersion),
            realName = options.dependOnEnv?packageNameWithEnv:packageName;
        console.info('即将上传的包名称：', realName);


        // info value in form-data must be a string or buffer
        var info = {
            name: moduleName,
            alwaysSync: options.snapshot || options.alwaysUpdate ?'on':'off',
            isPrivate: 'on',
            user: 'default',
            password: options.password || ''
        };

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
                        if(utils.isSnapshot(realName) || options.alwaysUpdate){
                            console.info('中央缓存已存在', realName, ',本次上传将覆盖之前的包！');
                        }else{
                            exit('中央缓存已存在' + realName + ',请更新版本！！！');
                            return;
                        }
                    }
                    registry.put(uploadDir, info, function(err){
                        //将版本重写package.json
                        options.snapshot && options.overwrite && rewritePkg();

                        console.info('删除临时目录');
                        shellUtils.rm('-rf', uploadDir);

                        exit(err);
                    });
                } else {
                    console.error('中央缓存服务不可用，无法上传！s');
                }
            });
        });
        source.pipe(target);

        //重写version
        function rewritePkg() {
            console.info('更新package.json里的版本信息');
            packageInfo.version = moduleVersion;
            fsExtra.writeJsonSync(npmPackagePath, packageInfo);
        }
    },
    /**
     * 发布到npm
     * @param  {object} options 输入参数
     * @return {[type]}         [description]
     */
    toNpm: function(options){
        var registry = options.registry;
        npmUtils.npmPublish(registry, this.exit);
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(err){
        if(err){
            console.error('发布失败：',err);
            process.exit(1);
        } else {
            console.info('******************发布结束******************');
            process.exit(0);
        }
    }
};
