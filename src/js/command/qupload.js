/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-22 10:22
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-22 10:23
*/



var _ = require('lodash'),
    qzzConfigUtils = require('../common/qzzConfigUtils'),
    swiftUtils = require('../common/swiftUtils');


var __cwd = process.cwd();
/*@Command({
    "name": "qupload",
    "alias":"qu",
    "des":"Upload a static source to repository",
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
        var params = swiftUtils.validate(options),
            p = _.extend({}, params, config.format());
        console.info('即将上传路径'+p.path+'到'+p.container+'的'+p.name);
        swiftUtils.upload(p, this.exit);
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
