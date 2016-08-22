/**
* 流程结束
* @Author: robin
* @Date:   2016-08-08 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-09 10:18:55
*/

'use strict';

/*@AutoLoad*/
module.exports = require('./Flow').extend({
    /**
     * business realization
     * @return
     */
    execute: function() {
        //do nothing
    }
}, {
    name: 'Done'
});
