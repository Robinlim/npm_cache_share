/**
 * @Author: wyw.wang <wyw>
 * @Date:   2016-09-09 16:09
 * @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:20:19
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
 * @param  {path}   dir                   将要放置到的目录路径
 * @param  {Function} cb                    [description]
 * @return {void}                         [description]
 */
nodeRegistry.prototype.get = function(packageName, dir, cb) {
    var fileExt = this.fileExt,
        moduleName = null;
    request
        .get({
            url: ['http:/', this.server, 'fetch', packageName].join('/'),
            // 某些存储（swift）时采用重定向下载，但是需要从服务器的原始返回中获取信息
            followRedirect : function(response){
                if(response.headers.modulename){
                    moduleName = response.headers.modulename
                }
                return true;
            }
        })
        .on('response', function(response) {
            if (response.statusCode == 200) {
                if(response.headers.modulename){
                    moduleName = response.headers.modulename;
                }
                // 获取文件名称
                var target = path.resolve(dir, moduleName + fileExt);
                // 解压文件操作
                var extractor = tar.Extract({
                        path: dir
                    })
                    .on('error', function(err) {
                        console.error(target + ' extract is wrong ', err.stack);
                        cb(err);
                    })
                    .on('end', function() {
                        console.debug(target + ' extract done!');
                        target = path.resolve(dir, moduleName);
                        cb(null, fs.existsSync(target) && target);
                    });
                // 请求返回流通过管道流入解压流
                response.pipe(extractor);
                return;
            } else {
                cb(new Error('下载模块异常,statusCode:'+response.statusCode));
            }
        })
        .on('error', function(err) {
            console.error(err);
            cb(err);
        });
};


/**
 * 上传模块目录到公共缓存
 * @param  {path}   dir      待上传的路径
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
nodeRegistry.prototype.put = function(dir, callback) {
    if (!this.serverReady() || !fs.existsSync(dir) || !this.token) {
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
            console.debug(dir + ' pack done!');
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
 * 判断服务是否正常,并返回服务端与当前工程模块依赖的交集
 * @param  {Array} list  工程的模块依赖
 * @param  {Function} cb        检查完后的回调
 * @return {void}
 */
nodeRegistry.prototype.check = function(list, cb) {
    var self = this;
    if (!self.server) {
        cb(false, null);
        return;
    }
    var form = {
        list: list,
        platform: utils.getPlatform()
    };
    request
        .post({
            url: 'http://' + self.server + '/check',
            form: form
        }, function(err, response, body) {
            if(err){
                console.error(self.server + '该服务不可正常访问，请检查服务！', err);
                cb(self.serverHealth = false, {});
            } else {
                var res, error;
                try {
                    res = JSON.parse(body);
                } catch (e) {
                    error = e;
                }
                if(error || res.status !== 0){
                    console.error(self.server + '服务异常，请检查服务！', error || res.message);
                    cb(self.serverHealth = false, {});
                }
                cb(self.serverHealth = true, res.data);
            }
        });
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
