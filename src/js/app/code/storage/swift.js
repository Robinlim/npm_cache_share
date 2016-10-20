/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-11 18:04
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:29
*/

var _ = require('lodash'),
    cache = require('./cache'),
    Swift = require('./swiftClient');

/*@Factory("swift")*/
function swift(config){
    var self = this;
    this.avaliable = false;
    this.config = {
        host: config[0],//'l-swift1.ops.dev.cn0.qunar.com',
        user: config[1],//'test:tester',
        pass: config[2] //'testing'
    };
    this.user = this.config.user.split(':')[0];
    var storage = new Swift(this.config, function(err, res){
        if(err) {
            handleInitError(err);
        } else if(storage.account && storage.token){
            self.avaliable = true;
            self.init();
        } else {
            handleInitError(new Error('Request token fail:'+res.statusCode));
        }
    });
    this.storage = storage;
}

swift.prototype.init = function(){
    var self = this;
    self.listRepository(function(err, list){
        if(err){
            handleInitError(err);
            return;
        }
        _.forEach(list, function(el){
            var repository = el.name;
            cache.addRepository(repository, {
                size: el.bytes,
                count: el.count
            });
            self.listPackages(repository, function(e, pcks){
                if(e){
                    handleInitError(e);
                    return;
                }
                _.forEach(pcks, function(pl){
                    cache.addPackage(repository, pl.name);
                });
            });
        });
    });
};

swift.prototype.sync = function(){
    cache.clear();
    this.init();
};

swift.prototype.check = function(){
    return this.avaliable;
};

swift.prototype.createRepository = function(repository, cbk){
    this.storage.createContainer(repository, function(err, res){
        if(err) {
            cbk(err);
        } else {
            cache.addRepository(repository);
            cbk(null, res);
        }
    });
};

swift.prototype.listRepository = function(cbk){
    // eg:［{"count": 5, "bytes": 36464, "name": "template"}］
    this.storage.listContainers(handlerResponse(cbk));
};

swift.prototype.listPackages = function(repository, cbk){
    // eg: [{"hash": "9f6e6800cfae7749eb6c486619254b9c", "last_modified": "2016-08-11T07:20:38.174980", "bytes": 3, "name": "/abssc/11.txt", "content_type": "text/plain"},{..}]
    this.storage.listObjects(repository, handlerResponse(cbk));
};

swift.prototype.listPackageInfo = function(repository, name, cbk){
    this.storage.retrieveObjectMetadata(repository, name, function(err, res){
        if(err || res.statusCode !== 200){
            cbk(err);
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
    res.setHeader('modulename', name);
    res.redirect(['http:/', this.config.host, this.user, repository, name].join('/'));
};

swift.prototype.put = function(repository, name, stream, cbk){
    this.storage.createObjectWithStream(repository, name, stream, function(err){
        if(err) {
            cbk(err);
        } else {
            cache.addPackage(repository, name);
            cbk();
        }
    });
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
