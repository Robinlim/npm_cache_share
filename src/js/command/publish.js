/**
* @Author: wyw.wang <wyw>
* @Date:   2016-12-07 10:12
* @Email:  wyw.wang@qunar.com
* @Last modified by:   xin.lin
* @Last modified time: 2017-11-24 10:13
*/



var fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    fsExtra = require('fs-extra'),
    utils = require('../common/utils'),
    fignore = require('fstream-ignore'),
    constant = require('../common/constant'),
    npmUtils = require('../common/npmUtils'),
    Factory = require('../annotation/Factory'),
    checkUtils = require('../common/checkUtils'),
    shellUtils = require('../common/shellUtils'),
    f2bConfigUtils = require('../common/f2bConfigUtils');

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
        ["-r, --registry [registry]", "specify the npm registry"],
        ["-v, --moduleVersion [moduleVersion]", "specify the module version"],
        ["-s, --snapshot", "specify this is a snapshot version"],
        ["-u, --alwaysUpdate", "this module will publish overwrite the same version on the server, and will always update when install, if -s not specify, the version remain unchanged"],
        ["-o, --overwrite", "if -s exist, it will overwrite the version into package.json"],
        ["--checkSnapshotDeps", "check if or not dependend on the snapshot module, default is ignore check"]
    ]
})*/

module.exports = {
    run: function(options){
        console.info('******************开始发布******************');
        var type = options.type,
            packageInfo;
        try {
            packageInfo = fsExtra.readJsonSync(npmPackagePath);
        } catch (e) {
            exit(e);
            return;
        }
        if(options.checkSnapshotDeps){
            checkUtils.snapshotDepsCheck(packageInfo.dependencies);
        }
        if(type === 'node'){
            console.info('将发布到中央缓存');
            this.toNode(options, packageInfo);
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
    toNode: function(options, packageInfo){
        var exit = this.exit;
        //校验工程命名
        var moduleName = packageInfo.name;
        f2bConfigUtils.checkName(moduleName, options.nameReg);

        var moduleVersion = options.moduleVersion || packageInfo.version;
        if(utils.isSnapshot(moduleVersion)){
            options.snapshot = true;
        }else if(options.snapshot){
            moduleVersion += (options.SNAPSHOTLINK || '-') + constant.VERSION_TYPE.SNAPSHOT;
        }

        if(options.snapshot){
            console.info('将发布SNAPSHOT版本，每次发布都会覆盖现有同名版本。');
        }else if(options.alwaysUpdate){
            console.info('设定该模块本次发布将会覆盖现有同名版本，但客户端已存在的缓存不会更新，可以到管理后台配置策略来强制更新客户端缓存！');
        }

        var packageName = utils.getModuleName(moduleName, moduleVersion);
        console.info('即将上传的包名称：', packageName);


        // info value in form-data must be a string or buffer
        var info = {
            name: moduleName,
            isPrivate: 'on',
            isGyp: utils.isGypModule(packageInfo.dependencies, __cwd) ? 'on': 'off',
            user: 'default',
            password: options.password || ''
        };
        var uploadDir = path.resolve(__cache, UPLOADDIR);
        utils.ensureDirWriteablSync(uploadDir);
        var tempDir = path.resolve(uploadDir, packageName);
        console.debug('temp upload path：', tempDir);
        fsExtra.emptyDirSync(tempDir);
        
        var source = fignore({
            path: __cwd,
            ignoreFiles: [".ignore", ".gitignore"]
        })
        .on('child', function (c) {
            console.debug('walking:', c.path.substr(c.root.path.length + 1));
        })
        .on('error', exit);
        //增加忽略文件
        source.addIgnoreRules(['.git/', '.gitignore', 'node_modules/']);

        var target = fstream.Writer(tempDir)
        .on('error', exit)
        .on('close', function(){
            //如果是snapshot，则上传的包需要修改package.json里的version
            if(options.snapshot){
                var pckPath = path.resolve(tempDir, PACKAGE);
                    packageInfo = fsExtra.readJsonSync(pckPath);
                if(!utils.isSnapshot(packageInfo.version)){
                    packageInfo.version = moduleVersion;
                    try {
                        fsExtra.writeJsonSync(pckPath, packageInfo);
                    } catch (e) {
                        exit(e);
                        return;
                    }
                }
            }
            console.info('开始上传模块');
            var registry = Factory.instance(options.type, options);
            registry.check([packageName], [], function(avaliable, data){
                if(avaliable){
                    if(data && data[packageName]){
                        if(utils.isSnapshot(packageName) || options.alwaysUpdate){
                            console.info('中央缓存已存在', packageName, ',本次上传将覆盖之前的包！');
                        }else{
                            exit('中央缓存已存在' + packageName + ',请更新版本！！！');
                            return;
                        }
                    }
                    console.debug('请求附加信息：' + JSON.stringify(info));
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
