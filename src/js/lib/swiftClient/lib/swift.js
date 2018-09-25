/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-13 19:11
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-13 19:22
*
* fix of npm module "swift" with several change, the code is from https://www.npmjs.com/package/swift
* 1. replace https with http.
* 2. add file stream support.
* 3. setTimeout to fetch new token, because the token is timeline.
*/

/**
 * dependencies.
 */
var _ = require('lodash'),
    requestExtra = require('request'),
    http = require('http'),
    crypto = require('crypto'),
    MultipartParser = require('./multipart').MultipartParser;

/**
 * Swift Class
 */
function Swift(options, callback) {
    //swift 下发的token过期时间
    if(!options.swiftTokenTimeout || options.swiftTokenTimeout == 'undefined'){
        options.swiftTokenTimeout = 86400000 //  24 * 60 * 60 * 1000
    }
    //认证过程的回调
    this._promise = null;

    this.options = _.extend({
        user: 'username',
        pass: 'userpass',
        host: 'hostname',
        port: 80,
        swiftTokenTimeout: 0
    }, options);

    //提前一秒获取token
    this.tokenTimeout = options.swiftTokenTimeout;
    //初次认证
    this.auth().then(function(res){
        callback(null, res);
    }).catch(function(err){
        callback(err);
    });
    
}

/**
 * 认证，定时更新token
 * @param  {Function} callback   回调
 * @return {void}
 */
Swift.prototype.auth = function(){
    var self = this;
    //首次认证
    if(!this.token || !this._promise){
        console.debug('init request swift token!!');
        authosize(this).then(interval).catch(interval);
    }

    return this._promise;

    //定时器
    function interval(){
        //定时重新认证
        setTimeout(function(){
            console.debug('request swift token interval!!');
            authosize(self).then(interval).catch(interval);
        }, self.tokenTimeout);
    }

    //认证
    function authosize(ctx){
        return self._promise = new Promise(function(resolve, reject){
            request.call(ctx, {
                headers: {
                    'X-Storage-User': ctx.options.user,
                    'X-Storage-Pass': ctx.options.pass
                }
            }, function(err, res) {
                if (!err && res.headers['x-storage-url'] && res.headers['x-auth-token']) {
                    ctx.path = '/' + res.headers['x-storage-url'].split('/').slice(3).join('/');
                    ctx.token = res.headers['x-auth-token'];
                }
                if(err){
                    reject(err);
                }else{
                    resolve(res);
                }
            }, null, true);
        });
    }
};

/**
 * 获得账户meta信息
 */
Swift.prototype.retrieveAccountMetadata = function(callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path,
            method: 'HEAD'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 获取容器meta信息
 */
Swift.prototype.retrieveContainerMetadata = function(container, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container,
            method: 'HEAD'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 获得容器列表
 */
Swift.prototype.listContainers = function(callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '?format=json'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 创建容器
 */
Swift.prototype.createContainer = function(container, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container,
            method: 'PUT',
            headers: {
              'X-Auth-Token': self.token,
              'X-Storage-Token': self.token,
              'X-Container-Read': ".r:*" // 设置container可以被任何人读
          }
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 删除容器
 */
Swift.prototype.deleteContainer = function(container, callback) {
    var self = this;
    this.auth().then(function(){
        var objects = [],
            deleted = 0,
            remove = function() {
              request.call(self, {
                  path: self.path + '/' + container,
                  method: 'DELETE'
              }, callback);
            };

        self.listObjects(container, function(err, result) {
        try {
            objects = JSON.parse(result.body);
        } catch(e) {}

        if (!objects.length) remove();
        // delete all objects in container first
        for (var i = 0; i < objects.length; i++)
            self.deleteObject(container, objects[i].name, function() {
                ++deleted == objects.length && remove();
            });
        });
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 列出对象
 */
Swift.prototype.listObjects = function(object, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + object + '?format=json'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 获取对象文件流信息
 */
Swift.prototype.getFile = function(container, object, callback, res) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container + '/' + object
        }, callback, {
            res: res
        });
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 获取对象
 */
Swift.prototype.retrieveObject = function(container, object, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container + '/' + object
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

/**
 * 创建和更新对象
 */
Swift.prototype.createObject = Swift.prototype.updateObject = function(container, object, callback, req) {
    var self = this;
    this.auth().then(function(){
        var options = {
            path: self.path + '/' + container + '/' + object,
            method: 'PUT',
            filename: object,
            headers: {
              'X-Auth-Token': self.token,
              'X-Storage-Token': self.token
          }
        };

        if (req.xhr) {
          options.headers['Content-Length'] = req.headers['content-length'];
        } else {
          var boundary = req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
          _.extend(options, {
              contentLength: req.headers['content-length'],
              encoding: 'utf-8',
              boundary: boundary[1] || boundary[2]
          });
          options.headers['Transfer-Encoding'] = 'chunked';
        }

        request.call(self, options, callback, {req: req});
    }).catch(function(err){
        callback(err);
    });
};

// added by wyw.wang
Swift.prototype.getObjectWithStream = function(container, object){
    var self = this;
    return new Promise(function(resolve, reject){
        this.auth().then(function(){
            var options = {
              url: ['http://', self.options.host, ':', self.options.port, self.path, '/', container, '/', object].join(''),
              headers: {
                  'X-Auth-Token': self.token,
                  'X-Storage-Token': self.token
              }
            };
            resolve(requestExtra(options));
        }).catch(function(err){
            reject(err);
        });
    });
};

Swift.prototype.createObjectWithStream = function(container, object, stream, callback) {
    var self = this;
    this.auth().then(function(){
        var options = {
          url: ['http://', self.options.host, ':', self.options.port, self.path , '/', container, '/', object].join(''),
          filename: object,
          headers: {
              'X-Auth-Token': self.token,
              'X-Storage-Token': self.token
          }
        };
        stream
            .on('error', function(err){
                callback(err);
            })
            .pipe(requestExtra.put(options, function(err){
                if(err){
                    callback(err);
                }else{
                    callback();
                }
            }))
    }).catch(function(err){
        callback(err);
    });
};

// Delete Object
Swift.prototype.deleteObject = function(container, object, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container + '/' + object,
            method: 'DELETE'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

// Retrieve Object Metadata *
Swift.prototype.retrieveObjectMetadata = function(container, object, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container + '/' + object,
            method: 'HEAD'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

// Update Object Metadata *
Swift.prototype.updateObjectMetadata = function(container, object, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: thi.path + '/' + container + '/' + object,
            method: 'POST'
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

// Copy Object
Swift.prototype.copyObject = function(container, destObject, fromContainer, sourceObject, callback) {
    var self = this;
    this.auth().then(function(){
        request.call(self, {
            path: self.path + '/' + container + '/' + destObject,
            method: 'PUT',
            headers: {
              'X-Auth-Token': self.token,
              'X-Storage-Token': self.token,
              'X-Copy-From': fromContainer + '/' + sourceObject
          }
        }, callback);
    }).catch(function(err){
        callback(err);
    });
};

// Move Object
Swift.prototype.moveObject = function(container, destObject, fromContainer, sourceObject, callback) {
    var self = this;
    this.auth().then(function(){
        //if (container == fromContainer) return callback('move error');
        self.copyObject(container, destObject, fromContainer, sourceObject, function(err, result) {
          self.deleteObject(fromContainer, sourceObject, function(err, result) {
            callback(err, result);
          });
        });
    }).catch(function(err){
        callback(err);
    });
};

module.exports = Swift;

function request(options, callback, pipe, isAuth) {
    var args = arguments,
        self = this;
    options = _.extend({
        host: this.options.host,
        port: this.options.port,
        path: '/auth/v1.0',
        method: 'GET',
        headers: {
          'X-Auth-Token': this.token,
          'X-Storage-Token': this.token
        }
    }, options);

    options.path = encodeURI(options.path);

    var client = http.request(options, function(res) {
        var buffers = [];
        if (pipe && pipe.res) {
            pipe.res.header('Content-Length', res.headers['content-length']);
            pipe.res.header('Content-Type', res.headers['content-type']);
        }

        res.on('data', function(buffer) {
            if (pipe && pipe.res) pipe.res.write(buffer);
            else buffers.push(buffer);
        });

        res.on('end', function(err){
            if(err){
                //异常
                callback && callback(err);
            }else if(res.statusCode == 200){
                //正常返回
                res.body = buffers.join('');
                callback && callback(err, res);
            }else if(res.statusCode == 401){
                //token过期
                console.error('swift request token is expired!!please upload again!!');
                callback && callback(new Error('swift request token is expired!!please upload again!!'));
            }else{
                callback && callback(null, {
                    statusCode: res.statusCode,
                    body: buffers.toString()
                });
            }
        });
    });

    client.on('error', function(err) {
        callback && callback(err);
        client.end();
    });

    if (!pipe || pipe.res) return client.end();

    var bytesReceived = 0,
        contentLength = 76,
        parser = options.boundary ? multipart(_.extend(options, {
          onHeadersEnd: function(part) {
            //options.contentLength -= contentLength + options.boundary.length * 2 + part.name.length + part.filename.length + part.mime.length + 8;
          },
          onPartData: function(buffer) {
            client.write(buffer);
          }
        })) : null;

    pipe.req.on('data', function(buffer) {
        parser ? parser.write(buffer) : client.write(buffer);
        pipe.req.emit('progress', bytesReceived += buffer.length, options.contentLength || options.headers['Content-Length']);
    });

    pipe.req.on('end', function() {
        client.end();
        callback && callback();
    });
}

function fileName(headerValue) {
    var m = headerValue.match(/filename="(.*?)"($|; )/i)
    if (!m) return;

    var filename = m[1].substr(m[1].lastIndexOf('\\') + 1);
    filename = filename.replace(/%22/g, '"');
    filename = filename.replace(/&#([\d]{4});/g, function(m, code) {
      return String.fromCharCode(code);
    });

    return filename;
}

function multipart(options) {
    var parser = new MultipartParser(),
        headerField,
        headerValue,
        part = {};

    parser.initWithBoundary(options.boundary);

    parser.onPartBegin = function() {
      part.headers = {};
      part.name = null;
      part.filename = null;
      part.mime = null;
      headerField = '';
      headerValue = '';
    };

    parser.onHeaderField = function(b, start, end) {
      headerField += b.toString(options.encoding, start, end);
    };

    parser.onHeaderValue = function(b, start, end) {
      headerValue += b.toString(options.encoding, start, end);
    };

    parser.onHeaderEnd = function() {
      headerField = headerField.toLowerCase();
      part.headers[headerField] = headerValue;

      var name = headerValue.match(/name="([^"]+)"/i);
      if (headerField == 'content-disposition') {
        if (name) part.name = name[1];
        part.filename = fileName(headerValue);
      } else if (headerField == 'content-type') {
        part.mime = headerValue;
      }

      headerField = '';
      headerValue = '';
    };

    parser.onHeadersEnd = function() {
      options.onHeadersEnd && options.onHeadersEnd(part);
    };

    parser.onPartData = function(b, start, end) {
      options.onPartData && options.onPartData(b.slice(start, end));
    };

    return parser;
}

