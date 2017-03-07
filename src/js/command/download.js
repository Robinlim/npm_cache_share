/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-08 16:17
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-08 16:19
*/

var swiftUtils = require('../common/swiftUtils'),
    _ = require('lodash');

var __cwd = process.cwd();
/*@Command({
    "name": "download [name] [path]",
    "alias":"d",
    "des":"Download a static source to repository, you can set the swift setting by parameters or use command 'ncs config set resourceSwift host|user|pass|container'",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-p, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(name, path, options){
        var params = _.extend({}, swiftUtils.getConfig(options, 'resourceSwift'), {
            name: name,
            path: path
        });

        swiftUtils.download(params, this.exit);
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(err){
        if(err){
            console.error(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
};
