/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-29 11:39:55
*/

'use strict'
require('shelljs/global');

var utils = require('../common/utils'),
    path = require('path');

/*@Command("clean")*/
module.exports = {
    run: function(ops) {
        //清除服务端缓存
        if(!ops.forServer){
            rm('-rf', utils.getCachePath() + path.sep + '*');
            return;
        }
        //清除客户端缓存
        rm('-rf', path.resolve(process.cwd(), 'npm_cache_share'));
        process.exit();
    }
}
