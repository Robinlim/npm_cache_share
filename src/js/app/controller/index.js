'use strict'
var path = require('path'),
    fsExtra = require('fs-extra'),
    utils = require('../../common/utils');

require('shelljs/global');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt(),
    UPLOADDIR = 'upload_dir',
    TOKENPATH = utils.getTokenPath();
/*@Controller*/
module.exports = {
    /*@RequestMapping("/fetch/{moduleName}/{moduleNameForPlatform}")*/
    fetch: function(req, res, moduleName, moduleNameForPlatform) {
        var modulePath = path.resolve(modulesCachePath, moduleName + fileExt);
        if (!test('-f', modulePath)) {
            modulePath = path.resolve(modulesCachePath, moduleNameForPlatform + fileExt);
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
    /*@RequestMapping("/upload")*/
    /*@ResponseBody*/
    upload: function(req, res) {
        var token = fsExtra.readJsonSync(TOKENPATH).token;
        console.log(token, req.headers.token)
        // check token for permission
        if(token !== req.headers.token){
            res.status(404).end({
                message: 'Token missing or wrong! Forbid uploading without token.'
            });
            return;
        }

        var multiparty = require('multiparty');
        // parse a file upload
        var form = new multiparty.Form({
            encoding: 'utf-8',
            uploadDir: modulesCachePath
        });

        form.parse(req, function(err, fields, files) {
            if (files.modules.length != 0) {
                var file = files.modules[0].path,
                    target = path.resolve(modulesCachePath, String(Date.now()));
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
                        var tarfile = path.resolve(modulesCachePath, file + fileExt);
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
                            mv('-f', tarfile, modulesCachePath);
                        });
                    });
                });
            }
            res.end({
                message: 'success'
            });
        });
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        res.status(500).end(err.message || err);
    }
}
