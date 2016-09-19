/**
* @Author: robin
* @Date:   2016-09-14 14:31:25
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:53:07
*/

'use strict'
var path = require('path'),
    fsExtra = require('fs-extra'),
    utils = require('../../common/utils'),
    directory = require('../widget/directory');

require('shelljs/global');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt(),
    TEMPDIR = path.resolve(modulesCachePath, '.tempdir'),
    UPLOADDIR = 'upload_dir',
    token = process.env.token;

fsExtra.ensureDirSync(TEMPDIR);
/*@Controller*/
module.exports = {
    /*@RequestMapping("/check")*/
    /*@ResponseBody*/
    check: function(req, res, reqData) {
        var cache = utils.lsDirectory(modulesCachePath),
            platform = reqData.platform,
            existCache = {};
        utils.traverseDependencies(reqData.data, function(v, k) {
            if (cache[k])
        });
        res.end({
            status: 200,
            data: null
        });
    },
    /*@RequestMapping(["/{repository}/fetch/{moduleName}/{moduleNameForPlatform}","/fetch/{moduleName}/{moduleNameForPlatform}"])*/
    fetch: function(req, res, repository, moduleName, moduleNameForPlatform) {
        var repositoryPath = this.resolveRepository(repository),
            modulePath = path.resolve(repositoryPath, moduleName + fileExt);
        if (!test('-f', modulePath)) {
            modulePath = path.resolve(repositoryPath, moduleNameForPlatform + fileExt);
            if (!test('-f', modulePath)) {
                // 不存在或不可读返回404
                res.statusCode = 404;
                res.end();
                return;
            }
            moduleName = moduleNameForPlatform;
        }
        res.setHeader('modulename', moduleName);
        res.download(modulePath);
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

        var repositoryPath = this.resolveRepository(repository);
        form.parse(req, function(err, fields, files) {
            if (files.modules.length != 0) {
                var file = files.modules[0].path,
                    target = path.resolve(TEMPDIR, String(Date.now()));
                console.info('开始接收文件！' + files.modules[0].originalFilename);
                //解压文件
                utils.extract(file, target, function(err) {
                    if (err) {
                        console.error('extract is wrong ', err.stack);
                        return;
                    }
                    //删除压缩文件
                    rm('-f', file);
                    //压缩每个模块
                    var modules = ls(path.resolve(target, UPLOADDIR)),
                        count = 0;
                    modules.forEach(function(file) {
                        var tarfile = path.resolve(repositoryPath, file + fileExt);
                        // compress
                        utils.compress(path.resolve(target, UPLOADDIR, file), tarfile, function(err) {
                            count++;
                            if (count == modules.length) {
                                //删除临时目录
                                process.nextTick(function() {
                                    rm('-rf', target);
                                    console.info('upload done!!');
                                });
                            }
                            if (err) {
                                console.error('compress wrong ', err.stack);
                                return;
                            }
                            //mv('-f', tarfile, repositoryPath);
                        });
                    });
                });
            }
            res.end({
                message: 'success'
            });
        });
    },
    /*@RequestMapping(["/diff","/{repository}/diff"])*/
    /*@ResponseBody*/
    diff: function(req, res, reqData, repository){
        var list = reqData.list,
            env = reqData.env;
        if(!Array.isArray(list)){
            res.end({
                status: -1,
                message: 'list should be an array!'
            });
            return;
        }
        res.end({
            status: 0,
            message: 'success',
            data: directory.diffPackages(repository || 'default', list, env)
        });
    },
    /*@RequestMapping("/list")*/
    /*@ResponseBody*/
    list: function(req, res, reqData){
        if(reqData.repository){
            if(reqData.name){
                res.end(directory.listPackages(repository,name));
            } else {
                res.end(directory.listModules(repository));
            }
        } else {
            res.end(directory.listAll());
        }
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        res.status(500).end(err.stack || err);
    }
}
function resolveRepository(name){
    var repositoryPath = path.join(modulesCachePath, name || 'default');
    fsExtra.ensureDirSync(repositoryPath);
    return repositoryPath;
},
