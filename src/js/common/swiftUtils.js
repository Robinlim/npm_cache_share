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
    Swift = require('../lib/swiftClient');

module.exports = {
    /**
     * 上传到swift
     * @param  {object}   params   {
     *                                  host: swift的地址
     *                                  user: swift账户名
     *                                  pass: swift账户密码
     *                                  container: swift容器名
     *                                  path: 待上传的路径
     *                                  name:  上传后的对象名称
     *                             }
     * @param  {Function} callback [description]
     * @return {void}            [description]
     */
    upload: function(params, callback){
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
                callback(err);
            } else {
                fstream.Reader(params.path).pipe(packer).pipe(river);
                swift.createObjectWithStream(params.container, params.name, river, callback);
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
                    })
                    .pipe(extractor);
            }
        });
    },
    /**
     * 检验参数合法性
     * @param  {object} options [description]
     * @return {object}
     */
    validate: function(options){
        var params = {};
        var swiftConfig = options.swiftConfig.split('|');
        params.host = options.host || swiftConfig[0];
        params.user = options.user || swiftConfig[1];
        params.pass = options.pass || swiftConfig[2];
        params.container = options.container || options.swiftContainer;
        for(var i in params){
            if(!params[i]){
                throw new Error('缺少参数：'+i);
            }
        }
        return params;
    }
};
