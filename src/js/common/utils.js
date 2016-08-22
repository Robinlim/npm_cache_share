/**
 * @Author: robin
 * @Date:   2016-08-18 14:18:18
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-22 19:49:39
 */
var path = require('path'),
    _ = require('lodash');
module.exports = {
    /**
     * 获取缓存的路径
     * @return {[type]} [description]
     */
    getCachePath: function() {
        var defaultCacheDirectory = process.env.NPM_CACHE_DIR;
        if (defaultCacheDirectory === undefined) {
            var homeDirectory = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
            if (homeDirectory !== undefined) {
                defaultCacheDirectory = path.resolve(homeDirectory, '.npm_cache_share');
            } else {
                defaultCacheDirectory = path.resolve('/tmp', '.npm_cache_share');
            }
        }
        return defaultCacheDirectory;
    },
    /**
     * 获得文件后缀
     * @return {[type]} [description]
     */
    getFileExt: function() {
        return '.tar.gz';
    },
    /**
     * 将参数序列化
     * @param  {[type]} nomnomOpts [description]
     * @return {[type]}            [description]
     */
    toString: function(nomnomOpts) {
        var ops = [];
        _.each(nomnomOpts || {}, function(v, k){
            if(k != '0' && k != '_'){
                ops.push('--' + k);
                if(typeof v != 'boolean'){
                    ops.push(v);
                }
            }
        });
        return ops.join(' ');
    }
};
