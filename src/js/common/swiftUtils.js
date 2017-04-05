/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-21 15:57
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-21 15:57
*/



var stream = require('stream'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    path = require('path'),
    Swift = require('../lib/swiftClient'),
    Utils = require('./utils');

var COMPRESS_TYPE = require('./constant').COMPRESS_TYPE;

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
        var name = params.compressType ? [params.name, params.compressType].join('.') : params.name ;
        console.info('即将查询容器' + params.container + '中' + name + '对象！！');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('实例化Swift失败：', err.stack || err);
                callback(err);
            } else {
                swift.retrieveObjectMetadata(params.container, name, function(err, res){
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
        var name = params.compressType ? [params.name, params.compressType].join('.') : params.name;
        console.info('即将删除容器' + params.container + '中' + name + '对象！！');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('实例化Swift失败：', err.stack || err);
                callback(err);
            } else {
                swift.deleteObject(params.container, name, function(err, res){
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
     *                                  compressType: 压缩方式
     *                             }
     * @param  {Function} callback [description]
     * @return {void}            [description]
     */
    upload: function(params, callback){
        var name = params.compressType ? [params.name, params.compressType].join('.') : params.name;
        console.info('即将打包文件路径：' + params.path + '，作为' + name + '上传至swift容器' + params.container + '!!!');

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('上传失败：', err.stack || err);
                callback(err);
            } else {
                var river = new stream.PassThrough();

                //压缩
                Utils.compress(params.path, params.destpath, params.compressType).pipe(river);
                //swift上传
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
     *                                  name: 待下载的对象名称
     *                                  compressType: 文件后缀
     *                             }
     * @param  {Function} callback [description]
     * @return {void}            [description]
     */
    download: function(params, callback){
        var name = params.name,
            extname = path.extname(name).substr(1),
            p = path.resolve(params.path);
        if(extname !== COMPRESS_TYPE.TAR && extname !== COMPRESS_TYPE.ZIP && extname.length !== 0){
            throw new Error('不识别的文件类型，须为.tar，或者.zip文件');
        }

        console.info('即将从容器' + params.container + '下载包' + name + '至路径' + p);

        if(extname.length === 0){
            //作为后续解压根据文件后缀来选择解压方式
            name = [name, params.compressType].join('.');
            console.info('没有文件后缀，默认以' + params.compressType + '方式进行解压');
        }

        var swift = new Swift({
                host: params.host,
                user: params.user,
                pass: params.pass
            }, function(err, res){
                if(err) {
                    throw new Error('下载失败：', err.stack || err);
                } else {
                    download();
                }
            });
        function download(){
            var river = new stream.PassThrough();

            swift.getObjectWithStream(params.container, name)
            .on('error', function(err){
                throw new Error(name + ' download is wrong ', err.stack);
            })
            .on('response', function(response){
                if(response.statusCode !== 200){
                    callback(new Error('Get source from swift return statusCode:'+response.statusCode));
                }
            })
            .on('end', function(err){
                console.debug(name + ' download done!');
                console.info('下载结束！');
            }).pipe(river);

            river.pipe(Utils.extract(name, p, function(){
                console.info('解压完成！');
            }));
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
