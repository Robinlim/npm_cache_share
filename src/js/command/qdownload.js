/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-22 10:22
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-22 10:23
*/



var _ = require('lodash'),
    asyncMap = require("slide").asyncMap,
    qzzConfigUtils = require('../common/qzzConfigUtils'),
    swiftUtils = require('../common/swiftUtils');

var __cwd = process.cwd();
/*@Command({
    "name": "qdownload",
    "alias":"qd",
    "des":"Download a static source to repository",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-w, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(options){
        try {
            var config = qzzConfigUtils.getConfig(__cwd);
        } catch (e) {
            this.exit(e);
        }
        var params = swiftUtils.validate(options);
        asyncMap(config.format(), function(el, cb){
            var p = _.extend({}, params, el);
            console.info('即将从容器'+p.container+'下载包'+p.name+'到'+p.path);
            swiftUtils.download(p, cb);
        }, this.exit);
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
