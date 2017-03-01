/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-22 10:22
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-02-28 10:23
*/



var _ = require('lodash'),
    f2bConfigUtils = require('../common/f2bConfigUtils'),
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
            var config = f2bConfigUtils.getConfig(__cwd),
                params = swiftUtils.validate(options),
                rs = config.format(),
                self = this, p;
            _.each(rs, function(cf){
                p = _.extend({}, params, cf);
                swiftUtils.upload(p, self.exit);
            });
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
