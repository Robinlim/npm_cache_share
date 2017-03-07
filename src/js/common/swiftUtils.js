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
                    //由于swift.js代码里会存在触发两次的场景，以下做兼容处理
                    if(typeof err != 'undefined' && typeof err.statusCode != "undefined"){
                        err = null;
                        res = err;
                    }
                    if(err){
                        console.error('获取容器信息失败：', err.stack || err);
                        callback(err);
                        return;
                    }
                    if(res.statusCode == 404){
                        swift.createContainer(params.container, function(err, res){
                            if(err) {
                                console.error('创建容器失败：', err.stack || err);
                                callback(err);
                                return;
                            }
                            callback(null, res);
                        });
                    } else {
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

        var name = params.name,
            river = new stream.PassThrough(),
            packer = tar.Pack({
                noProprietary: true
            }).on('error', function(err) {
                console.error(name + ' pack is wrong ', err.stack);
                callback(err);
            }).on('end', function() {
                console.debug(name + ' pack done!');
            });

        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('上传失败：', err.stack || err);
                callback(err);
            } else {
                fstream.Reader(params.path).pipe(packer).pipe(river);
                swift.createObjectWithStream(params.container, params.name, river, function(){
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
     * @return {void}            [description]
     */
    download: function(params, callback){
        console.info('即将从容器' + params.container + '下载包' + params.name + '至路径' + params.path);

        var name = params.name,
            river = new stream.PassThrough(),
            extractor = tar.Extract({
                path: params.path
            }).on('error', function(err) {
                console.error(name + ' extract is wrong ', err.stack);
                callback(err);
            }).on('end', function() {
                console.debug(name + ' extract done!');
                callback();
            });
        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                console.error('下载失败：', err.stack || err);
                callback(err);
            } else {
                swift.getObjectWithStream(params.container, params.name)
                    .on('error', function(err){
                        console.error(name + ' download is wrong ', err.stack);
                        callback(err);
                    })
                    .on('response', function(response){
                        if(response.statusCode !== 200){
                            callback(new Error('Get source from swift return statusCode:'+response.statusCode));
                        }
                    })
                    .on('end', function(){
                        console.debug(name + ' download done!');
                        console.info('下载成功！');
                    })
                    .pipe(extractor);
            }
        });
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
        try {
            return fs.realpathSync(filepath);
        } catch (e) {
            this.exit(e);
        }
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
