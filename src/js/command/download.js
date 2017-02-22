/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-08 16:17
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-08 16:19
*/

var swiftUtils = require('../common/swiftUtils');

var __cwd = process.cwd();
/*@Command({
    "name": "download [name] [path]",
    "alias":"d",
    "des":"Download a static source to repository",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-w, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(name, path, options){
        var params = this.validate(path, name, options);
        swiftUtils.download(params, this.exit);
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
        console.info('即将从容器'+params.container+'下载包'+params.name+'到'+params.path);
        return params;
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(err){
        if(err){
            console.error('下载失败：', err.stack || err);
            process.exit(1);
        } else {
            console.info('下载成功！');
            process.exit(0);
        }
    }
};
