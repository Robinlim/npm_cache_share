/**
 * @Author: robin
 * @Date:   2017-03-27 14:18:18
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-03-27 15:21:30
 */
var fs = require('fs'),
    path = require('path'),
    archiver = require('archiver'),
    tar = require('tar'),
    unzipper = require('unzipper');

var COMPRESS_TYPE = require('./constant').COMPRESS_TYPE;

var utils = module.exports = {
    /**
     * 压缩流
     * @param  {String}   dir      需要压缩的文件夹路径
     * @param  {String}   destpath 压缩文件里的路径
     * @param  {String}   type     压缩类型
     * @param  {Function} callback   回调
     * @return {stream}
     */
    compressStream: function(dir, destpath, type, callback){
        return tarZipCompressStream(dir, destpath, type, callback);
    },
    /**
     * 解压流
     * @param  {String} dir          解压到的目录
     * @param  {String} type         解压模式 zip 或者 tar
     * @param  {Function} callback   回调
     * @return {[type]}            [description]
     */
    extractStream: function(dir, type, callback){
        if(type !== COMPRESS_TYPE.TAR && type !== COMPRESS_TYPE.ZIP ){
            throw new Error('compress type must be tar or zip!!!');
        }
        return type == COMPRESS_TYPE.TAR ? tarExtractStream(dir, callback) : zipExtractStream(dir, callback);
    }
};

/**
 * 压缩流
 * @param  {String}   dir      需要压缩的文件夹路径
 * @param  {String}   destpath 压缩文件里的路径
 * @param  {String}   type     压缩类型
 * @param  {Function} callback   回调
 * @return {stream}
 */
function tarZipCompressStream(dir, destpath, type, callback) {
    //错误处理
    function onError(err) {
        throw err;
    }

    //压缩结束
    function onEnd() {
        callback && callback();
    }

    var compressStream = archiver(type)
            .on('error', onError)
            .on('end', onEnd),
        stat = fs.statSync(dir);

    //文件命名不要以.properties结尾，会导致上级目录也存在
    if(stat.isDirectory()){
        compressStream.directory(dir, destpath);
    }else{
        compressStream.file(destpath || dir);
    }
    return compressStream.finalize();

}

/**
 * 解压流
 * @param  {String} dir          解压到的目录
 * @param  {Function} callback   回调
 * @return {void}
 */
function tarExtractStream(dir, callback) {
    //错误处理
    function onError(err) {
        throw err;
    }
    //处理结束
    function onEnd() {
        callback && callback();
    }

    var extractor = tar.Extract({
            path: dir
        })
        .on('error', onError)
        .on('end', onEnd);

    return extractor;
}
function zipExtractStream(dir, callback) {
    //错误处理
    function onError(err) {
        throw err;
    }
    //处理结束
    function onClose() {
        callback && callback();
    }
    var extractor = unzipper.Extract({
            path: dir
        })
        .on('error', onError)
        .on('close', onClose);
    return extractor;
}
