/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-22 10:22
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-02-28 10:23
*/



var _ = require('lodash'),
    asyncMap = require("slide").asyncMap,
    f2bConfigUtils = require('../common/f2bConfigUtils'),
    swiftUtils = require('../common/swiftUtils');

var __cwd = process.cwd();
/*@Command({
    "name": "qdownload",
    "alias":"qd",
    "des":"Download a static source to repository, you can set the swift setting by parameters or use command 'ncs config set resourceSwift host|user|pass|container'",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-p, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(options){
        try {
            var params = swiftUtils.getConfig(options, 'resourceSwift'),
                rs = f2bConfigUtils.getConfig(__cwd).format(),
                self = this;

            asyncMap(rs, function(el, cb){
                var p = _.extend({}, params, el);
                //container优先取参数或者配置文件里的
                params.container && (p.container = params.container);
                swiftUtils.download(p, cb);
            }, this.exit);
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
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
};
