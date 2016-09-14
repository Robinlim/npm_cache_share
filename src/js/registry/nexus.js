/**
* @Author: wyw.wang <wyw>
* @Date:   2016-09-09 16:09
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-09-09 16:11
*/

var path = require('path'),
    fs = require('fs'),
    stream = require('stream'),
    fsExtra = require('fs-extra'),
    fstream = require('fstream'),
    request = require('request'),
    tar = require('tar'),
    _ = require('lodash');

function nexusRegistry(config){
    this.repository = config.repository;
    this.auth = config.auth;
    this.fileExt = '.tar';
}

/**
 * 拉取一个依赖
 * @param  {String}   name     模块名
 * @param  {path}   dir      放置到的文件夹
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
nexusRegistry.prototype._get = function(name, dir, callback){
    var url = this.repository + name + this.fileExt;
    request.get({
        url: url
    }).on('response', function(res) {
        if (res.statusCode == 200) {
            // 获取文件名称
            var target = path.resolve(dir, name);
            // 解压文件操作
            var extractor = tar.Extract({
                    path: dir
                })
                .on('error', function(err){
                    console.error(name + ' extract is wrong ', err.stack);
                    callback(null, false);
                })
                .on('end', function(){
                    console.info(name + ' extract done!');
                });
            // 请求返回流通过管道流入解压流
            res.pipe(extractor);
            return;
        } else {
            callback();
        }
    });
};

/**
 * 按照模块名或者含环境的模块名拉取依赖
 * @param  {String}   moduleName            不含环境的模块名
 * @param  {String}   moduleNameForPlatform 含环境的模块名
 * @param  {path}   dir                   放置到的文件夹
 * @param  {Function} callback              [description]
 * @return {void}                         [description]
 */
nexusRegistry.prototype.get = function(moduleName, moduleNameForPlatform, dir, callback){
    var self = this;
    console.info('try get', moduleName);
    self._get(moduleName, dir, function(err){
        if(err){
            console.info('try get', moduleNameForPlatform);
            self._get(moduleNameForPlatform, dir, callback);
        } else {
            callback();
        }
    })
};


/**
 * 放置一个模块（文件夹）到公共缓存
 * @param  {path}   target   模块路径
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
nexusRegistry.prototype._put = function (target, callback) {
    var name = path.basename(target),
        url = this.repository + name + this.fileExt;
    var river =  new stream.PassThrough(),
        packer = tar.Pack({
            noProprietary: true
        }).on('error', function(err){
            console.error(name + ' pack is wrong ', err.stack);
            callback(err);
        })
        .on('end', function(){
            console.info(name + ' pack done!');
        });
    fstream.Reader(target).pipe(packer).pipe(river);
    request.put({
        url: url,
        auth: this.auth,
        body: river
    }, function(err, res, body) {
        if (err || res.statusCode !== 201) {
            console.error(name,'上传失败', err? err.message||JSON.stringify(err): res.toJSON());
            callback(err || new Error('send fail, statusCode:'+ res.statusCode));
            return;
        }
        console.info(name,'上传成功');
        callback();
    });
};


/**
 * 放置一批模块到公共缓存
 * @param  {path}   dir      模块目录
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
nexusRegistry.prototype.put = function(dir, callback){
    var self = this;
    fs.readdir(dir, function(err, files){
        if(err){
            callback(err);
            return;
        }
        var bulk = [];
        _.forEach(files, function(file){
            bulk.push(
                new Promise(function(resolve, reject){
                    self._put(path.resolve(dir, file), function(err){
                        if(err){
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                })
            );
        });
        Promise.all(bulk).then(function(){
            callback();
        },function(err){
            callback(err);
        });
    });
};

/**
 * 校验nexus服务是否可用
 * @param  {Function} cb 检查完后的回调
 * @return {void}      [description]
 */
nexusRegistry.prototype.check = function(cb){
    //TODO 目前仅检查了可以访问，还需更精确的确定源可用，用户密码可用
    request.get(this.repository)
    .on('response', _.bind(function() {
        cb(this.serverHealth = true);
    }, this))
    .on('error', _.bind(function(err) {
        console.error(this.repository + '该服务不可正常访问，请检查服务！', err);
        cb(this.serverHealth = false);
    }, this));
};

module.exports = nexusRegistry;
