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
    "des":"Upload a static source to repository by package.json, you can set the swift setting by parameters or use command 'ncs config set resourceSwift host|user|pass|container'",
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
            //如果指定container，则对象创建在该container下
            if(params.container){
                _.each(rs, function(cf){
                    var p = _.extend({}, params, cf);
                    swiftUtils.upload(p, self.exit);
                });
            //如果没有指定container，则会根据rs里的container值来创建（该值等同于package.json中的project），对象会存放在该container下
            }else{
                _.each(rs, function(cf){
                    var p = _.extend({}, params, cf);
                    swiftUtils.ensureContainerExist(p, function(err, res){
                        if(err){
                            self.exit(err);
                            return;
                        }
                        swiftUtils.upload(p, self.exit);
                    });
                });
            }
        } catch (e) {
            if(e){
                console.error(e.stack || e);
            }
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
