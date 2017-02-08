/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-08 16:17
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-08 16:19
*/

var fs = require('fs'),
    Path = require('path'),
    stream = require('stream'),
    fstream = require('fstream'),
    tar = require('tar'),
    Swift = require('../lib/swiftClient');

var __cwd = process.cwd();
/*@Command({
    "name": "upload [path] [name]",
    "alias":"u",
    "des":"Upload a static source to repository",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-w, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(path, name, options){
        var exit = this.exit;
        var params = this.validate(path, name, options);
        var river = new stream.PassThrough(),
            packer = tar.Pack({
                noProprietary: true
            }).on('error', function(err) {
                console.error(name + ' pack is wrong ', err.stack);
                exit(err);
            }).on('end', function() {
                console.debug(name + ' pack done!');
            });
        var swift = new Swift({
            host: params.host,
            user: params.user,
            pass: params.pass
        }, function(err, res){
            if(err) {
                exit(err);
            } else {
                fstream.Reader(params.path).pipe(packer).pipe(river);
                swift.createObjectWithStream(params.container, params.name, river, exit);
            }
        });
    },
    /**
     * 检验参数合法性
     * @param  {object} options [description]
     * @return {object}
     */
    validate: function(path, name, options){
        var params = {};
        params.name = name;
        params.path = path;
        var swiftConfig = options.swiftConfig.split('|');
        params.host = options.host || swiftConfig[0];
        params.user = options.user || swiftConfig[1];
        params.pass = options.pass || swiftConfig[2];
        params.container = options.container || options.swiftContainer;
        for(var i in params){
            if(!params[i]){
                this.exit(new Error('缺少参数：'+i));
            }
        }
        params.path = this.check(params.path);
        console.info('即将上传路径'+params.path+'到'+params.container+'的'+params.name);
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
     * 退出
     * @return {[type]} [description]
     */
    exit: function(err){
        if(err){
            console.error('上传失败：', err.stack || err);
            process.exit(1);
        } else {
            console.info('上传成功！');
            process.exit(0);
        }
    }
};
