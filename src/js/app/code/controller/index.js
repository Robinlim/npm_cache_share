/**
* @Author: robin
* @Date:   2016-09-14 14:31:25
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:53:07
*/

'use strict'
var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    stream = require('stream'),
    utils = require('../../../common/utils'),
    shellUtils = require('../../../common/shellUtils'),
    constant = require('../../../common/constant'),
    storage = require('../storage'),
    packageList = require('../dao/packageList');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt(),
    TEMPDIR = path.resolve(modulesCachePath, '.tempdir'),
    UPLOADDIR = constant.UPLOADDIR,
    token = process.env.token;

fsExtra.ensureDirSync(TEMPDIR);

/*@Controller*/
module.exports = {
    /*@RequestMapping(["/{repository}/check","/check"])*/
    /*@ResponseBody*/
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
            data: _.extend(
                storage.diffPackages(repository || 'default', list, platform),
                packageList.diffSync(checkSyncList)
            )
        });
    },
    /*@RequestMapping(["/{repository}/fetch/{name}","/fetch/{name}"])*/
    fetch: function(req, res, repository, name) {
        console.log('[fetch]', repository || 'default', name);
        var filename = decodeURIComponent(name) + fileExt;
        storage.get(repository || 'default', filename, res);
    },
    /*@RequestMapping(["/{repository}/upload","/upload"])*/
    /*@ResponseBody*/
    upload: function(req, res, repository) {
        // check token for permission,if token exists
        if(token && token !== req.headers.token){
            res.status(404).end({
                message: 'Token missing or wrong! Forbid uploading without token.'
            });
            return;
        }

        var multiparty = require('multiparty');
        // parse a file upload
        var form = new multiparty.Form({
            encoding: 'utf-8',
            uploadDir: TEMPDIR
        });

        var repositoryPath = resolveRepository(repository);
        form.parse(req, function(err, fields, files) {
            console.info('接收到的附加信息', fields);
            // TODO: mutliparty的fields的每个字段都是数组，暂时先全取数组第一项
            if(fields && fields.name){
                var name = fields.name[0],
                    password = fields.password[0];
                if(packageList.auth(name, password)){
                    packageList.add(name, {
                        alwaysSync: fields.alwaysSync && (fields.alwaysSync[0] === 'on'),
                        isPrivate: fields.isPrivate && (fields.isPrivate[0] === 'on'),
                        user: fields.user[0],
                        password: password
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
                        count = 0;
                    modules.forEach(function(file) {
                        var riverCompress = new stream.PassThrough();

                        utils.compress(path.resolve(target, UPLOADDIR, file), file, constant.COMPRESS_TYPE.TAR).pipe(riverCompress);

                        storage.put(repository, file + fileExt, riverCompress, function(err){
                            if (err) {
                                console.error(file + fileExt + ' upload to swift is wrong: ', err.stack);
                                return;
                            }
                            count++;
                            if (count == modules.length) {
                                //删除临时目录
                                process.nextTick(function() {
                                    shellUtils.rm('-rf', target);
                                    console.info('upload done!!');
                                });
                            }
                        });
                    });
                }));
            }
            res.end({
                status: 0,
                message: 'success'
            });
        });
    },
    /*@RequestMapping("/list/{versionType}")*/
    /*@ResponseBody*/
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
    /*@ResponseBody*/
    info: function(req, res, reqData, repository){
        var name = reqData.name,
            version = reqData.version,
            platform = reqData.platform,
            all = storage.listPackages(utils.isSnapshot(version), repository, name) || [],
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
        rtn.isPrivate = packageList.checkPrivate(name);
        if(rtn.isPrivate){
            if(!version || version === 'latest'){
                rtn.version = utils.getLastestVersion(packages);
            }
            var fullname = name + '@' + rtn.version,
                packageNameForPlatform = utils.joinPackageName(fullname, platform),
                packageName = fullname;
            if(packages.indexOf(packageNameForPlatform) > -1){
                rtn.full = packageNameForPlatform;
            } else if (packages.indexOf(packageName) > -1){
                rtn.full = packageName;
            }
        }
        console.info('info', name, version, platform, 'rth:', rtn);
        res.end({
            status: 0,
            message: 'succ',
            data: rtn
        });
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        console.error(err.stack);
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
