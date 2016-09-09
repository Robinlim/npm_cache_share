/**
* @Author: wyw.wang <wyw>
* @Date:   2016-09-09 16:09
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-09-09 16:11
*/

var path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    request = require('request'),
    tar = require('tar'),
    _ = require('lodash');

function nexusRegistry(config){
    this.repository = config.repository;
    this.auth = config.auth;
}

nexusRegistry.prototype.get = function(name, dir, callback){
    var url = this.repository + name;
    request.get({
        url: url
    }).on('response', function(res) {
        if (res.statusCode == 200) {
            // 获取文件名称
            var target = path.resolve(dir, name);
            console.log(target)
            // // 解压文件操作
            // var extractor = tar.Extract({
            //         path: dir
            //     })
            //     .on('error', function(err){
            //         console.error(target + ' extract is wrong ', err.stack);
            //         callback(null, false);
            //     })
            //     .on('end', function(){
            //         console.info(target + ' extract done!');
            //         callback(null, fs.existsSync(target) && target);
            //     });
            // // 请求返回流通过管道流入解压流
            // res.pipe(extractor);
            res.pipe(fs.createWriteStream(target));
            return;
        } else {
            callback();
        }
    });
};

nexusRegistry.prototype.put = function (target, callback) {
    var name = path.basename(target),
        url = this.repository + name;
    request.put({
        url: url,
        auth: this.auth,
        formData: {
            body: fs.createReadStream(target)
        }
    }, function(err, res, body) {
        if (err || res.status !== 201) {
            console.error('上传失败:', err || 'code:'+res.status);
            callback();
            return;
        }
        console.info('上传成功');
        callback();
    });
};

module.exports = nexusRegistry;
