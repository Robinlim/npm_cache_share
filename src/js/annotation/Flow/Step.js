/**
* 流程步骤
* @Author: robin
* @Date:   2016-08-08 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-09 14:06:22
* @example
* 	\/*Flow(["",""])*\/
* 	\/*Flow("")*\/
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
    name: 'Step'
});
