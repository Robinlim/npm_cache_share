/**
 * @Author: robin
 * @Date:   2016-08-18 14:18:18
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-29 12:05:23
 */
var path = require('path'),
    _ = require('lodash'),
    tar = require('tar'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    fstream = require('fstream');

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
     * @param  {Object} nomnomOpts options object, nomnom module parse the command
     * @return {String}            生成 --option 这样的字符串拼接
     */
    toString: function(nomnomOpts) {
        var ops = [];
        _.each(nomnomOpts || {}, function(v, k) {
            if (k != '0' && k != '_') {
                ops.push('--' + k);
                if (typeof v != 'boolean') {
                    ops.push(v);
                }
            }
        });
        return ops.join(' ');
    },
    /**
     * 压缩处理
     * @param  {String}   dir      需要压缩的文件夹路径
     * @param  {String}   target   压缩生成的文件路径
     * @param  {Function} callback 回调
     * @return {void}
     */
    compress: function(dir, target, callback) {
        var dirDest = fs.createWriteStream(target);
        //错误处理
        function onError(err) {
            callback(err);
        }

        //压缩结束
        function onEnd() {
            console.info('compress done!');
        }

        var packer = tar.Pack({
                noProprietary: true
            })
            .on('error', onError)
            .on('end', onEnd);

        // This must be a "directory"
        fstream.Reader({
                path: dir,
                type: "Directory"
            })
            .pipe(packer)
            .pipe(dirDest)
            .on('error', onError)
            .on('close', callback)
    },
    /**
     * 解压处理
     * @param  {String} target       需要解压的文件
     * @param  {String} dir          解压到的目录
     * @param  {Function} callback   回调
     * @return {void}
     */
    extract: function(target, dir, callback) {
        //错误处理
        function onError(err) {
            callback(err);
        }
        //处理结束
        function onEnd() {
            callback();
        }

        var extractor = tar.Extract({
                path: dir
            })
            .on('error', onError)
            .on('end', onEnd);

        fs.createReadStream(target)
            .on('error', onError)
            .pipe(extractor);
    },
    /**
     * 确保一个文件夹存在并且可写入
     * @param  {Path} dir 文件夹路径
     * @return {void}
     */
    ensureDirWriteablSync: function(dir) {
        try {
            fsExtra.ensureDirSync(dir);
            fs.accessSync(dir, fs.W_OK);
        } catch (e) {
            console.error('Cannnot write into '+dir+', Please try running this command again as root/Administrator.');
            throw e;
        }
    }
};
