/**
 * @Author: robin
 * @Date:   2016-08-17 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-19 12:59:16
 */

'use strict'
var path = require('path'),
    targz = require('tar.gz'),
    fsExtra = require('fs-extra');

require('shelljs/global');

var modulesCachePath = path.resolve(process.cwd(), 'npm_cache_share'),
    fileExt = require('../common/utils').getFileExt(),
    LIBNAME = 'node_modules';

/*@Command("server")*/
/*@Controller*/
module.exports = {
    run: function(opts) {
        var nodeAnnotation = require('node-annotation');
        var app = require('../app');
        nodeAnnotation.app(app);
        var server = app.listen(opts.port || '8888', function() {
            console.log('Express server listening on port %d', server.address().port);
            fsExtra.ensureDirSync(modulesCachePath);
        });
    },
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

                targz().extract(file, target, function(err) {
                    if (err) {
                        console.error('extract targz is wrong ', err.stack);
                        return;
                    }
                    //删除压缩文件
                    rm('-f', file);
                    //压缩每个模块
                    var modules = ls(path.resolve(target, LIBNAME)),
                        count = 0;
                    modules.forEach(function(file) {
                        var tarfile = path.resolve(modulesCachePath, file + fileExt);
                        // compress
                        targz().compress(path.resolve(target, LIBNAME, file), tarfile, function(err) {
                            count++;
                            if (count == modules.length) {
                                //删除临时目录
                                process.nextTick(function() {
                                    rm('-rf', target);
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
    }
}
