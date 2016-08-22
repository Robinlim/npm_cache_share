/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-22 20:03:07
*/

'use strict'
require('shelljs/global');

var utils = require('../common/utils'),
    path = require('path');

/*@Command("clean")*/
module.exports = {
    run: function(ops) {
        if(!ops.forServer){
            rm('-rf', utils.getCachePath() + path.sep + '*');
            return;
        }
        rm('-rf', path.resolve(process.cwd(), 'npm_cache_share'));
        process.exit();
    }
}
