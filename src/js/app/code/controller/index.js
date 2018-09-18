/**
* @Author: robin
* @Date:   2016-09-14 14:31:25
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:53:07
*/

'use strict'
var fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),
    semver = require('semver'),
    stream = require('stream'),
    fsExtra = require('fs-extra'),
    multiparty = require('multiparty'),
    utils = require('../../../common/utils'),
    npmUtils = require('../../../common/npmUtils'),
    constant = require('../../../common/constant'),
    shellUtils = require('../../../common/shellUtils'),
    storage = require('../storage');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt(),
    TEMPDIR = path.resolve(modulesCachePath, '.tempdir'),
    UPLOADDIR = constant.UPLOADDIR,
    SPLIT = constant.SPLIT,
    token = process.env.token;

fsExtra.ensureDirSync(TEMPDIR);

/*@Controller*/
module.exports = {
    /*@Autowired("privatemodules")*/
    packageList: null,
    /*@RequestMapping(["/{repository}/check","/check"])*/
    /*@ResponseBodyDeal*/
    check: function(req, res, reqData, repository){
        var list = reqData.list || [],
            checkSyncList = reqData.checkSyncList || [],
            platform = reqData.platform;
        if(!(Array.isArray(list) && Array.isArray(checkSyncList))){
            res.end({
                status: -1,
                message: 'list should be an array!'
            });
            return;
        }
        res.end({
            status: 0,
            message: 'success',
            data: storage.diffPackages(repository || 'default', list, checkSyncList, platform, this.packageList.list())
        });
    },
    /*@RequestMapping(["/{repository}/fetch/{name}","/fetch/{name}"])*/
    fetch: function(req, res, repository, name) {
        console.info('[fetch]', repository || 'default', name);
        var filename = decodeURIComponent(name) + fileExt;
        storage.get(repository || 'default', filename, res);
    },
    /*@RequestMapping(["/{repository}/upload","/upload"])*/
    /*@ResponseBodyDeal*/
    upload: function(req, res, repository) {
        // check token for permission,if token exists
        if(token && token !== req.headers.token){
            res.status(404).end({
                message: 'Token missing or wrong! Forbid uploading without token.'
            });
            return;
        }

        // parse a file upload
        var form = new multiparty.Form({
            encoding: 'utf-8',
            uploadDir: TEMPDIR
        });

        var repositoryPath = resolveRepository(repository),
            packageList = this.packageList;
        form.parse(req, function(err, fields, files) {
            if(err){
                console.error(err);
                res.end({
                    status: 500,
                    message: '文件流出错!!!'
                });
                return;
            }
            console.info('接收到的附加信息', JSON.stringify(fields));
            // TODO: mutliparty的fields的每个字段都是数组，暂时先全取数组第一项
            if(fields && fields.name){
                var name = fields.name[0],
                    password = fields.password[0];
                if(packageList.auth(name, password)){
                    packageList.add(name, {
                        isPrivate: fields.isPrivate && (fields.isPrivate[0] === 'on'),
                        isGyp: fields.isGyp && (fields.isGyp[0] === 'on'),
                        user: fields.user[0],
                        password: password
                    }, function(err){
                        if(err){
                            res.end({
                                status: 500,
                                message: err.stack || err
                            });
                            return;
                        }
                    });
                } else {
                    res.end({
                        status: -2,
                        message: '没有upload名为'+name+'的包的权限！请检查-p/--password配置!'
                    });
                    return;
                }
            }
            if (!files){
                res.end({
                    status: 500,
                    message: '文件流出错!!!'
                });
                return;
            }
            if (files.modules.length != 0) {
                var file = files.modules[0].path,
                    target = path.resolve(TEMPDIR, String(Date.now()));
                console.info('开始接收文件！' + files.modules[0].originalFilename);

                fs.createReadStream(file).pipe(utils.extract(file, target, function(){
                    //删除压缩文件
                    shellUtils.rm('-f', file);
                    //压缩每个模块
                    var modules = shellUtils.ls(path.resolve(target, UPLOADDIR)),
                        count = 0, errorObj = false;
                    modules.forEach(function(file) {
                        var riverCompress = new stream.PassThrough();

                        utils.compress(path.resolve(target, UPLOADDIR, file), file, constant.COMPRESS_TYPE.TAR).pipe(riverCompress);

                        storage.put(repository, file + fileExt, riverCompress, function(err){
                            if (err) {
                                console.error(file + fileExt + ' upload to swift is wrong: ', err.stack);
                                errorObj = err.message || err.stack;
                            }else{
                                console.debug(file + fileExt + ' upload to swift done');
                            }
                            count++;
                            if (count == modules.length) {
                                //删除临时目录
                                process.nextTick(function() {
                                    shellUtils.rm('-rf', target);
                                    console.info('upload done!!');
                                    if(errorObj){
                                        res.end({
                                            status: 500,
                                            message: errorObj
                                        });
                                    }else{
                                        res.end({
                                            status: 0,
                                            message: 'success'
                                        });
                                    }
                                });
                            }
                        });
                    });
                }));
            }
        });
    },
    /*@RequestMapping("/list/{versionType}")*/
    /*@ResponseBodyDeal*/
    list: function(req, res, versionType, reqData){
        var isSnapshotB = isSnapshot(versionType);
        if(reqData.repository){
            if(reqData.name){
                res.end(storage.listPackages(isSnapshotB, reqData.repository,reqData.name));
            } else {
                res.end(storage.listModules(isSnapshotB, reqData.repository));
            }
        } else {
            res.end(storage.listAll(isSnapshotB));
        }
    },
    /*@RequestMapping("/{repository}/info")*/
    /*@ResponseBodyDeal*/
    info: function(req, res, reqData, repository){
        var name = reqData.name,
            version = reqData.version,
            platform = reqData.platform,
            all = storage.listPackages(utils.isSnapshot(version), repository, name.replace(RegExp('/', 'g'), SPLIT)) || [],
            fileExt = utils.getFileExt(),
            packages = _.map(all, function(el){
                return _.trimEnd(el, fileExt);
            }),
            rtn = {
                name: name,
                version: version,
                full: null,
                isPrivate: false
            };
        // 判断包是否是私有包
        rtn.isPrivate = this.packageList.checkPrivate(name);
        if(rtn.isPrivate){
            if(!version || version === 'latest'){
                rtn.version = utils.getLastestVersion(packages);
            }
            var fullname = name.replace(RegExp('/', 'g'), SPLIT) + '@' + rtn.version,
                packageNameForPlatform = utils.joinPackageName(fullname, platform);
            if(packages.indexOf(packageNameForPlatform) > -1){
                rtn.full = packageNameForPlatform;
            } else if (packages.indexOf(fullname) > -1){
                rtn.full = fullname;
            }
        }
        console.info('info', JSON.stringify(rtn));
        res.end({
            status: 0,
            message: 'succ',
            data: rtn
        });
    },
    /*@RequestMapping("/{repository}/versions/latest")*/
    /*@ResponseBodyDeal*/
    latestVersion: function(req, res, reqData, repository){
        var name = reqData.name,
            version;
        // 判断包是否是私有包
        if(this.packageList.checkPrivate(name)){
            var all = storage.listPackages(false, repository, name.replace(RegExp('/', 'g'), SPLIT)) || [],
                fileExt = utils.getFileExt(),
                packages = _.map(all, function(el){
                    return _.trimEnd(el, fileExt);
                });
            version = utils.getLastestVersion(packages);
        }
        npmUtils.getLastestVersion(name, function(err, v){
            //如果不存在则报错
            if(err){
                if(version){
                    res.end({
                        status: 0,
                        message: 'succ',
                        data: version
                    });
                }else{
                    res.end({
                        status: 1,
                        message: err
                    });
                }
                return;
            }
            //比较ncs源和npm源之间的版本，取大者
            if(!version){
                res.end({
                    status: 0,
                    message: 'succ',
                    data: v
                });
            }else{
                res.end({
                    status: 0,
                    message: 'succ',
                    data: semver.gt(v, version) ? v : version
                });
            }
        });
    },
    /*@ExceptionHandler*/
    /*@ResponseBodyDeal*/
    error: function(err, req, res){
        console.error(err.stack || err);
        res.status(500).end(err.stack || err);
    }
}

function resolveRepository(name){
    var repositoryPath = path.join(modulesCachePath, name || 'default');
    fsExtra.ensureDirSync(repositoryPath);
    return repositoryPath;
}

function isSnapshot(versionType) {
    return versionType.toUpperCase() == constant.VERSION_TYPE.SNAPSHOT;
}
