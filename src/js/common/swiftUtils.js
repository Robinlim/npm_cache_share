/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-21 15:57
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-21 15:57
*/



var stream = require('stream'),
    fstream = require('fstream'),
    tar = require('tar'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    path = require('path'),
    Swift = require('../lib/swiftClient');

module.exports = {
    /**
     * 保证容器存在
     * @param  {object}   params   {
     *                                  host: swift的地址
     *                                  user: swift账户名
     *                                  pass: swift账户密码
     *                                  container: swift容器名
     *                             }
     * @param  {Function} callback
     * @return {void}
     */
    ensureContainerExist: function(params, callback){
        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('实例化Swift失败：', err.stack || err);
                callback(err);
            } else {
                swift.retrieveContainerMetadata(params.container, function(err, res){
                    if(err){
                        if(err.statusCode == 404) {
                            swift.createContainer(params.container, function(err, res){
                                if(err) {
                                    console.error('创建容器失败：', err.stack || err);
                                    callback(err);
                                    return;
                                }
                                callback(null, res);
                            });
                        }else{
                            console.error('获取容器信息失败：', err.stack || err);
                            callback(err);
                        }
                        return;
                    }else if(res && res.statusCode != 404){
                        callback(null, res);
                    }
                });
            }
        });
    },
    /**
     * 查看对象是否存在
     * @param  {[type]}   params   [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    objectExist: function(params, callback) {
        console.info('即将查询容器' + params.container + '中' + params.name + '对象！！');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('实例化Swift失败：', err.stack || err);
                callback(err);
            } else {
                swift.retrieveObjectMetadata(params.container, params.name, function(err, res){
                    if(err){
                        if(err.statusCode == 404) {
                            callback(new Error('容器或对象不存在！！'));
                        }else{
                            console.error('获取容器信息失败：', err.stack || err);
                            callback(err);
                        }
                        return;
                    }else if(res && res.statusCode != 404){
                        callback(null, res);
                    }
                });
            }
        });
    },
    /**
     * 删除对象
     * @param  {[type]}   params   [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    deleteObject: function(params, callback) {
        console.info('即将删除容器' + params.container + '中' + params.name + '对象！！');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('实例化Swift失败：', err.stack || err);
                callback(err);
            } else {
                swift.deleteObject(params.container, params.name, function(err, res){
                    if(err){
                        if(err.statusCode == 404) {
                            callback(new Error('容器或对象不存在！！'));
                        }else{
                            console.error('删除对象信息失败：', err.stack || err);
                            callback(err);
                        }
                        return;
                    }else if(res && res.statusCode != 404){
                        callback(null, res);
                    }
                });
            }
        });
    },
    /**
     * 上传到swift
     * @param  {object}   params   {
     *                                  host: swift的地址
     *                                  user: swift账户名
     *                                  pass: swift账户密码
     *                                  container: swift容器名
     *                                  path: 待上传的路径
     *                                  name: 上传后的对象名称
     *                             }
     * @param  {Function} callback [description]
     * @return {void}            [description]
     */
    upload: function(params, callback){
        console.info('即将打包文件路径：' + params.path + '，作为' + params.name + '上传至swift容器' + params.container + '!!');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('上传失败：', err.stack || err);
                callback(err);
            } else {
                var isDir = fs.statSync(params.path).isDirectory(),
                    river = new stream.PassThrough(),
                    name = params.name;
                if(isDir){
                    var packer = tar.Pack({
                            noProprietary: true
                        }).on('error', function(err) {
                            console.error(name + ' pack is wrong ', err.stack);
                            callback(err);
                        }).on('end', function() {
                            console.debug(name + ' pack done!');
                        });
                    fstream.Reader(params.path).pipe(packer).pipe(river);
                }else{
                    fstream.Reader(params.path).pipe(river);
                }
                swift.createObjectWithStream(params.container, name, river, function(){
                    console.info('上传成功！');
                    callback.apply(callback, arguments);
                });
            }
        });
    },
    /**
     * 从swfit下载
     * @param  {object}   params   {
     *                                  host: swift的地址
     *                                  user: swift账户名
     *                                  pass: swift账户密码
     *                                  container: swift容器名
     *                                  path: 待下载到的路径
     *                                  name:  待下载的对象名称
     *                             }
     * @param  {Function} callback [description]
     * @param  {Boolean}  notTar  [description]
     * @return {void}            [description]
     */
    download: function(params, callback, notTar){
        console.info('即将从容器' + params.container + '下载包' + params.name + '至路径' + params.path);

        var name = params.name;
        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('下载失败：', err.stack || err);
                callback(err);
            } else {
                download();
            }
        });
        function download(){
            var p = path.resolve(params.path),
                downStream = swift.getObjectWithStream(params.container, params.name)
                .on('error', function(err){
                    console.error(name + ' download is wrong ', err.stack);
                    callback(err);
                })
                .on('response', function(response){
                    if(response.statusCode !== 200){
                        callback(new Error('Get source from swift return statusCode:'+response.statusCode));
                    }
                })
                .on('end', function(err){
                    console.debug(name + ' download done!');
                    console.info('下载结束！');
                });
            if(notTar || notTar == 'true'){
                var name, np;
                //正则效率不高，但对于名称匹配也足矣
                params.name.replace(/(\w*)\/([^\/]+)$/, function($, $1, $2){
                    np = $1;
                    name = $2;
                });
                fsExtra.ensureDirSync(path.join(p, np));
                downStream.pipe(fs.createWriteStream(path.join(p, params.name)));
            }else{
                var extractor = tar.Extract({
                    path: p
                }).on('error', function(err) {
                    console.error(name + 'extract is wrong ', err.stack);
                    callback(err);

                }).on('end', function() {
                    console.debug(name + ' extract done!');
                    callback();
                });
                downStream.pipe(extractor);
            }
        }
    },
    /**
     * 检验参数合法性
     * @param  {object} options [description]
     * @param  {object} whitelist [description]
     * @return {object}
     */
    validate: function(options, whitelist){
        var params = {
                host: options.host,
                user: options.user,
                pass: options.pass,
                container: options.container
            };
        for(var i in params){
            if(!params[i] && !(whitelist && whitelist[i])){
                throw new Error('缺少参数：'+i);
            }
        }
        return params;
    },
    /**
     * 校验路径合法性，返回全路径
     * @param  {string} filepath [description]
     * @return {string}          [description]
     */
    check: function(filepath){
        return fs.realpathSync(filepath);
    },
    /**
     * 获取swift配置信息
     * @param  {Object} options     [description]
     * @param  {String} name        [description]
     * @param  {Object} whitelist   [description]
     * @return {Object}             [description]
     */
    getConfig: function(options, name, whitelist){
        var swiftConfig = (options[name] || '').split('|'),
            params = this.validate({
                host: options.host || swiftConfig[0],
                user: options.user || swiftConfig[1],
                pass: options.pass || swiftConfig[2],
                container: options.container || swiftConfig[3]
            }, whitelist);
        return params;
    }
};
