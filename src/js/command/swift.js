/**
* @Author: robin
* @Date:   2017-03-07 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-03-07 17:30:24
*/

'use strict'

var _ = require('lodash'),
    swiftUtils = require('../common/swiftUtils'),
    utils = require('../common/utils');

/*@Command({
    "name": "swift [action] [name]",
    "alias":"w",
    "des":"use swift quickly",
    options:[
        ["-h, --host [host]", "host of swift"],
        ["-u, --user [user]", "user of swift"],
        ["-p, --pass [pass]", "pass of swift"],
        ["-c, --container [container]", "container in swift"]
    ]
})*/
module.exports = {
    run: function(action, name, options) {
        try {
            var params = swiftUtils.getConfig(options, 'resourceSwift'),
                snapshotParams = swiftUtils.getConfig(options, 'resourceSnapshotSwift'),
                command = { query:1, delete:1 };
            params.name = name;

            if(command[action]){
                this[action]( utils.isSnapshot(name) && snapshotParams || params, this.exit);
            }else{
                throw new Error('非法swift指令操作:' + action);
            }
        } catch (e) {
            this.exit(e);
        }
    },
    /**
     * 查询对象是否存在
     * @param  {Object}   params [description]
     * @param  {Function} callback [description]
     * @return {[type]}        [description]
     */
    query: function(params, callback) {
        swiftUtils.objectExist(params, function(err, res){
            if(!err){
                console.info('该对象存在!!');
            }
            callback(err, res);
        });
    },
    /**
     * 删除对象
     * @param  {Object}   params [description]
     * @param  {Function} callback [description]
     */
    delete: function(params, callback){
        swiftUtils.deleteObject(params, function(err, res){
            if(!err){
                console.info('删除对象完成!!');
            }
            callback(err, res);
        });
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
}
