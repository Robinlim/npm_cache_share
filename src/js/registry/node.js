/**
 * @Author: wyw.wang <wyw>
 * @Date:   2016-09-09 16:09
 * @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-14 19:34:14
 */

var path = require('path'),
    fs = require('fs'),
    stream = require('stream'),
    fsExtra = require('fs-extra'),
    fstream = require('fstream'),
    request = require('request'),
    tar = require('tar'),
    _ = require('lodash');

var utils = require('../common/utils');
/*@Factory("node")*/
function nodeRegistry(config) {
    this.server = config.repository;
    this.token = config.token;
    this.fileExt = utils.getFileExt();
}

/**
 * 从公共缓存拉取模块
 * @param  {String}   moduleName            不含环境的模块名
 * @param  {String}   moduleNameForPlatform 含环境的模块名
 * @param  {path}   dir                   将要放置到的目录路径
 * @param  {Function} cb                    [description]
 * @return {void}                         [description]
 */
nodeRegistry.prototype.get = function(moduleName, moduleNameForPlatform, dir, cb) {
    request
        .get(['http:/', this.server, 'fetch', moduleName, moduleNameForPlatform].join('/'))
        .on('response', function(response) {
            if (response.statusCode == 200) {
                // 获取文件名称
                var target = path.resolve(dir, response.headers.modulename + this.fileExt);
                // 解压文件操作
                var extractor = tar.Extract({
                        path: dir
                    })
                    .on('error', function(err) {
                        console.error(target + ' extract is wrong ', err.stack);
                        cb(null, false);
                    })
                    .on('end', function() {
                        console.info(target + ' extract done!');
                        target = path.resolve(__cache, response.headers.modulename);
                        cb(null, fs.existsSync(target) && target);
                    });
                // 请求返回流通过管道流入解压流
                response.pipe(extractor);
                return;
            }
            cb(null, false);
        })
        .on('error', function(err) {
            cb(null, false);
            console.error(err);
        });
};


/**
 * 上传模块目录到公共缓存
 * @param  {path}   dir      待上传的路径
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
nodeRegistry.prototype.put = function(dir, callback) {
    if (!this.serverReady() || !fs.existsSync(dir)) {
        callback();
        return;
    }
    console.info('开始压缩需要上传模块');
    var self = this;
    var packer = tar.Pack({
            noProprietary: true
        }).on('error', function(err) {
            console.error(dir + ' pack is wrong ', err.stack);
            callback(err);
        })
        .on('end', function() {
            console.info(dir + ' pack done!');
        });
    // TODO stream.PassThrough() donnot work!
    //var river =  new stream.PassThrough();
    var tmpFile = path.resolve(path.dirname(dir), Date.now() + self.fileExt),
        river = fs.createWriteStream(tmpFile);

    river.on('error', function(err) {
        console.error(err);
        callback(err);
    }).on('finish', function() {
        console.info('同步模块至服务http://' + self.server);
        request.post({
            headers: {
                token: self.token,
            },
            url: 'http://' + self.server + '/upload',
            formData: {
                modules: fs.createReadStream(tmpFile)
                    // modules: {
                    //     value: river,
                    //     options: {
                    //         filename: Date.now() + self.fileExt,
                    //         contentType: 'application/x-tar'
                    //     }
                    // }
            }
        }, function(err, res, body) {
            if (err || res.statusCode !== 200) {
                console.error('上传失败:', err || body);
                callback();
                return;
            }
            console.info('上传成功');
            callback();
        });
    });
    fstream.Reader(dir).pipe(packer).pipe(river);
};


/**
 * 判断服务是否正常
 * @return {[type]} [description]
 */
nodeRegistry.prototype.check = function(cb) {
    if (!this.server) {
        cb();
        return;
    }
    request
        .get('http://' + this.server + '/healthcheck.html')
        .on('response', _.bind(function() {
            cb(this.serverHealth = true);
        }, this))
        .on('error', _.bind(function(err) {
            console.error(this.server + '该服务不可正常访问，请检查服务！', err);
            cb(this.serverHealth = false);
        }, this));
};

/**
 * 判断服务是否正常
 * @return {[type]} [description]
 */
nodeRegistry.prototype.serverReady = function() {
    if (!this.server) return false;
    if (this.serverHealth) return true;
    if (this.serverHealth === false) return false;
    return false;
};

module.exports = nodeRegistry;
