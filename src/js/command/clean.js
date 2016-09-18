/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-14 15:31:29
*/

'use strict'
require('shelljs/global');

var utils = require('../common/utils'),
    path = require('path');

/*@Command({"name": "clean", "alias":"c", "des":"Clear the local npm module cache", options:[["-s, --forServer", "if it is false, clean the npm cache in client, or clean the server cache"]]})*/
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
