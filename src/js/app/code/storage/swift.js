/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-11 18:04
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/

var _ = require('lodash'),
    cache = require('../cache'),
    Swift = require('../../../lib/swiftClient'),
    Utils = require('../../../common/utils');

function swift(config, snapshotConfig){
    var self = this;
    //SNAPSHOT版本
    this.snapshot = init(snapshotConfig, true);
    //正式版本
    this.release = init(config, false);

    function init(opts, isSnapshot) {
        var rs = {
            avaliable: false,
            config: {
                host: opts[0],//'l-swift1.ops.dev.cn0.qunar.com',
                user: opts[1],//'test:tester',
                pass: opts[2] //'testing'
            }
        };
        rs.user = rs.config.user.split(':')[0];
        rs.storage = new Swift(rs.config, function(err, res){
            if(err) {
                handleInitError(err);
            } else if(rs.storage.account && rs.storage.token){
                rs.avaliable = true;
                self.init(isSnapshot);
            } else {
                handleInitError(new Error('Request token fail:'+res.statusCode));
            }
        });
        return rs;
    }
}

swift.prototype.init = function(isSnapshot){
    var self = this;
    self.listRepository(isSnapshot, function(err, list){
        if(err){
            handleInitError(err);
            return;
        }
        _.forEach(list, function(el){
            var repository = el.name;
            cache.addRepository(isSnapshot, repository, {
                size: el.bytes,
                count: el.count
            });
            self.listPackages(isSnapshot, repository, function(e, pcks){
                if(e){
                    handleInitError(e);
                    return;
                }
                _.forEach(pcks, function(pl){
                    cache.addPackage(isSnapshot, repository, pl.name);
                });
            });
        });
    });
};

swift.prototype.sync = function(){
    var self = this;
    cache.clear().then(function(){
        console.info('重新加载本地缓存');
        //SNAPSHOT
        self.init(true);
        //RELEASE
        self.init(false);
    });
};

swift.prototype.check = function(){
    return this.snapshot.avaliable && this.release.avaliable;
};

swift.prototype.createRepository = function(isSnapshot, repository, cbk){
    this.getConfig(isSnapshot).storage.createContainer(repository, function(err, res){
        if(err) {
            cbk(err);
        } else {
            cache.addRepository(isSnapshot, repository);
            cbk(null, res);
        }
    });
};

swift.prototype.listRepository = function(isSnapshot, cbk){
    // eg:［{"count": 5, "bytes": 36464, "name": "template"}］
    this.getConfig(isSnapshot).storage.listContainers(handlerResponse(cbk));
};

swift.prototype.listPackages = function(isSnapshot, repository, cbk){
    // eg: [{"hash": "9f6e6800cfae7749eb6c486619254b9c", "last_modified": "2016-08-11T07:20:38.174980", "bytes": 3, "name": "/abssc/11.txt", "content_type": "text/plain"},{..}]
    this.getConfig(isSnapshot).storage.listObjects(repository, handlerResponse(cbk));
};

swift.prototype.listPackageInfo = function(isSnapshot, repository, name, cbk){
    this.getConfig(isSnapshot).storage.retrieveObjectMetadata(repository, name, function(err, res){
        if(err || res.statusCode !== 200){
            cbk(err || {
                statusCode: res.statusCode,
                message: res.body
            });
            return;
        }
        var header = res.headers;
        /*headers:
       { server: 'openresty/1.7.10.2',
         date: 'Fri, 14 Oct 2016 07:38:13 GMT',
         'content-type': 'image/jpeg',
         'content-length': '41243',
         connection: 'close',
         'accept-ranges': 'bytes',
         'last-modified': 'Mon, 11 Jul 2016 03:25:00 GMT',
         etag: '9e5d2e6ab7f7dbc18bb1c30ad1deb98a',
         'x-timestamp': '1468207499.97934',
         'x-object-meta-mtime': '1468207479.850734',
         'x-trans-id': 'txad18a3ae328b4725b4cd0-0058008b65',
         expires: 'Thu, 31 Dec 2037 23:55:55 GMT',
         'cache-control': 'max-age=315360000' }
         */
        cbk(null, {
            size: header['content-length'],
            birthtime: null,
            mtime: new Date(header['last-modified'])
        });
    });
};

swift.prototype.get = function(repository, name, res){
    var opts = this.getConfig(name),
        url = ['http:/', opts.config.host, opts.user, repository, name].join('/');
    if(res){
        res.setHeader('modulename', name);
        res.redirect(url);
    }else{
        return url;
    }
};

swift.prototype.put = function(repository, name, stream, cbk){
    var storage = this.getConfig(name).storage;
    storage.createObjectWithStream(repository, name, stream, function(err){
        if(err) {
            cbk(err);
        } else {
            //由于存在上传swift后仍然有不存在的情况，但缓存里已经记录，导致最终获取失败，故增加校验
            storage.retrieveObjectMetadata(repository, name, function(err, res){
                if(!err && res && res.statusCode == 200){
                    cache.addPackage(Utils.isSnapshot(name), repository, name);
                }
            });
            cbk();
        }
    });
};

swift.prototype.getConfig = function(name) {
    if(typeof name == 'boolean'){
        return name ? this.snapshot : this.release;
    }
    return Utils.isSnapshot(name) ? this.snapshot : this.release;
};

/**
 * 处理初始化阶段的错误
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
function handleInitError(err){
    console.error(err);
}

/**
 * 处理返回数据body部分
 * @param  {Function} cbk 处理完的回调
 * @return {void}     [description]
 */
function handlerResponse(cbk){
    return function(err, res){
        if(err) {
            cbk(err);
            return;
        }
        try {
            var data = JSON.parse(res.body);
        } catch (e) {
            cbk(e);
            return;
        }
        cbk(null, data);
    }
}

module.exports = swift;
