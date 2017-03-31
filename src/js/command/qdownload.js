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
        ["-c, --container [container]", "container in swift"],
        ["-a, --auto", "according to package.json,use project parameter in f2b to set the value of container, it will ignore container parameter in command"]
    ]
})*/
module.exports = {
    run: function(options){
        try {
            //如果设定了auto参数，会忽略指令的container参数以及resourceSwift中container的配置，会将package.json里的f2b下的key值作为container来下载对象
            var whitelist = {};
            if(options.auto){
                whitelist.container = 1;
            }

            var params = swiftUtils.getConfig(options, 'resourceSwift', whitelist),
                rs = f2bConfigUtils.getConfig(__cwd).format(),
                self = this;

            asyncMap(rs, function(el, cb){
                var p = _.extend({}, params, el);
                //如果auto为true,则将package.json中f2b里的key值作为container来下载对象，否则container取参数或者配置文件里的。
                if(options.auto){
                    p.container = el.container;
                }else{
                    params.container && (p.container = params.container);
                }
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
            console.error(err.stack || err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
};
