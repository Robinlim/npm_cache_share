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
            var config = f2bConfigUtils.getConfig(__cwd),
                params = swiftUtils.validate(options);
            asyncMap(config.format(), function(el, cb){
                var p = _.extend({}, params, el);
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
