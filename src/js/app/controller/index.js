/**
* @Author: robin
* @Date:   2016-09-14 14:31:25
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:53:07
*/

'use strict'
var path = require('path'),
    fs = require('fs'),
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
    /*@RequestMapping(["/{repository}/check","/check"])*/
    /*@ResponseBody*/
    check: function(req, res, reqData, repository){
        var list = reqData.list || [],
            platform = reqData.platform;
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
            data: directory.diffPackages(repository || 'default', list, platform)
        });
    },
    /*@RequestMapping(["/{repository}/fetch/{name}","/fetch/{name}"])*/
    fetch: function(req, res, repository, name) {
        console.log('[fetch]', repository || 'default', name);
        var filename = decodeURIComponent(name),
            filepath = path.join(modulesCachePath, repository||'default', filename + fileExt);
        fs.access(filepath, fs.R_OK, function(err){
            if(err){
                res.status(404).end(filename + 'not exist!')
            } else {
                res.setHeader('modulename', filename);
                res.download(filepath);
            }
        });
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
    /*@RequestMapping("/list")*/
    /*@ResponseBody*/
    list: function(req, res, reqData){
        if(reqData.repository){
            if(reqData.name){
                res.end(directory.listPackages(reqData.repository,reqData.name));
            } else {
                res.end(directory.listModules(reqData.repository));
            }
        } else {
            res.end(directory.listAll());
        }
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
