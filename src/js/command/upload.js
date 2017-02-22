/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-08 16:17
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-08 16:19
*/

var fs = require('fs'),
    swiftUtils = require('../common/swiftUtils');


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
        var params = this.validate(path, name, options);
        swiftUtils.upload(params, this.exit);
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
