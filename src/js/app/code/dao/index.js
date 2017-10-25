/**
* @Author: robin
* @Date:   2017-05-08 10:37
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/


var Factory = require('../annotation/Factory');
/*@Component("privatemodules")*/
module.exports = (function(opts) {
    var zkClass = opts.zookeeper ? require('./zkPackageList') : require('./packageList');
    return new zkClass(opts);
})(process.env);
