/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-13 19:11
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-13 19:22
*
* fix of npm module "swift" with several change, the code is from https://www.npmjs.com/package/swift
* 1. replace https with http.
* 2. change swift interface version from "v1.0" to "v1" for it not being recognized.
* 3. add file stream support.
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
 * FIXME
 * In my case, "v1.0" is not recognized, instead "v1" work.
 */
var VERSION = 'v1';

/**
 * Class.
 */

function Swift(options, callback) {
    this.options = extend({
        user: 'username',
        pass: 'userpass',
        host: 'hostname',
        port: 80
    }, options);

    request.call(this, {
        headers: {
            'X-Storage-User': this.options.user,
            'X-Storage-Pass': this.options.pass
        }
    }, _.bind(function(err, res) {
        if (!err && res.headers['x-storage-url'] && res.headers['x-auth-token']) {
          this.account = res.headers['x-storage-url'].split('v1/')[1];
          this.token = res.headers['x-auth-token'];
        }
        callback && callback(err, res);
    }, this));
}


/**
 * Util.
 */

function extend(destination, source) {
  for (var property in source)
    destination[property] = source[property];
  return destination;
}

function request(options, callback, pipe) {
  options = extend({
      host: this.options.host
    , port: this.options.port
    , path: '/auth/v1.0'
    , method: 'GET'
    , headers: {
        'X-Auth-Token': this.token
      //, 'X-Storage-Token': this.token
    }
  }, options);

 // options.headers['User-Agent'] = 'Node.JS Swift API Client';
  options.path = encodeURI(options.path);
  var client = http.request(options, function(res) {
    var buffers = [];
    if (pipe && pipe.res) {
      pipe.res.header('Content-Length', res.headers['content-length']);
      pipe.res.header('Content-Type', res.headers['content-type']);
    }

    if (!pipe || pipe.res) {
      res.on('data', function(buffer) {
        if (pipe && pipe.res) pipe.res.write(buffer);
        else buffers.push(buffer);
      });

      res.on('end', function(err){
        res.body = buffers.join('');
        callback && callback(err, res);
      });
    }

    res.on('end', function(err){
      if (res.statusCode >= 400) {
        callback && callback({
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

  var bytesReceived = 0
    , contentLength = 76
    , parser = options.boundary ? multipart(extend(options, {
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
  var parser = new MultipartParser()
    , headerField
    , headerValue
    , part = {};

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

/**
 * Storage Account Services.
 */

// List Containers
Swift.prototype.listContainers = function(callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '?format=json'
  }, callback);
};

// Retrieve Account Metadata *
Swift.prototype.retrieveAccountMetadata = function(callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account
    , method: 'HEAD'
  }, callback);
};


/**
 * Storage Container Services.
 */

// List Objects
Swift.prototype.listObjects = function(object, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + object + '?format=json'
  }, callback);
};

// Create Container fix it
Swift.prototype.createContainer = function(container, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container
    , method: 'PUT'
    , headers: {
        'X-Auth-Token': this.token,
        'X-Container-Read': ".r:*" // 设置container可以被任何人读
    }
  }, callback);
};

// Delete Container
Swift.prototype.deleteContainer = function(container, callback) {
  var self = this
    , objects = []
    , deleted = 0
    , remove = function() {
      request.call(self, {
          path: '/'+VERSION+'/' + self.account + '/' + container
        , method: 'DELETE'
      }, callback);
    };

  this.listObjects(container, function(err, result) {
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
};

// Retrieve Container Metadata *
Swift.prototype.retrieveContainerMetadata = function(container, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container
    , method: 'HEAD'
  }, callback);
};


/**
 * Storage Object Services.
 */

// Object stream on pipe
Swift.prototype.getFile = function(container, object, callback, res) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
  }, callback, {
      res: res
  });
};

// Retrieve Object *
Swift.prototype.retrieveObject = function(container, object, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
  }, callback);
};

// Create/Update Object
Swift.prototype.createObject = Swift.prototype.updateObject = function(container, object, callback, req) {
  var options = {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
    , method: 'PUT'
    , filename: object
    , headers: {
        'X-Auth-Token': this.token
      //, 'Content-Type': req.headers['content-type']
      //, 'ETag': crypto.createHash('md5').update(container + '/' + object).digest('hex')
      //, 'X-Object-Meta-PIN': 1234
    }
  };

  if (req.xhr) {
    options.headers['Content-Length'] = req.headers['content-length'];
  } else {
    var boundary = req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    extend(options, {
        contentLength: req.headers['content-length']
      , encoding: 'utf-8'
      , boundary: boundary[1] || boundary[2]
    });
    options.headers['Transfer-Encoding'] = 'chunked';
  }

  request.call(this, options, callback, {req: req});
};

// added by wyw.wang
Swift.prototype.getObjectWithStream = function(container, object){
    var options = {
      url: ['http://',this.options.host,':',this.options.port,'/',VERSION,'/',this.account,'/',container,'/',object].join(''),
      headers: {
          'X-Auth-Token': this.token
          //, 'Content-Type': req.headers['content-type']
          //, 'ETag': crypto.createHash('md5').update(container + '/' + object).digest('hex')
          //, 'X-Object-Meta-PIN': 1234
      }
    };
    return requestExtra(options);
};

Swift.prototype.createObjectWithStream = function(container, object, stream, callback) {
  var options = {
    url: ['http://',this.options.host,':',this.options.port,'/',VERSION,'/',this.account,'/',container,'/',object].join(''),
    filename: object,
    headers: {
        'X-Auth-Token': this.token
        //, 'Content-Type': req.headers['content-type']
        //, 'ETag': crypto.createHash('md5').update(container + '/' + object).digest('hex')
        //, 'X-Object-Meta-PIN': 1234
    }
  };
  stream.pipe(requestExtra.put(options))
      .on('error', function(err){
          callback(err);
      })
      .on('end', function(){
          callback();
      });
};


// Delete Object
Swift.prototype.deleteObject = function(container, object, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
    , method: 'DELETE'
  }, callback);
};

// Retrieve Object Metadata *
Swift.prototype.retrieveObjectMetadata = function(container, object, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
    , method: 'HEAD'
  }, callback);
};

// Update Object Metadata *
Swift.prototype.updateObjectMetadata = function(container, object, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + object
    , method: 'POST'
  }, callback);
};

// Copy Object
Swift.prototype.copyObject = function(container, destObject, fromContainer, sourceObject, callback) {
  request.call(this, {
      path: '/'+VERSION+'/' + this.account + '/' + container + '/' + destObject
    , method: 'PUT'
    , headers: {
        'X-Auth-Token': this.token
      , 'X-Copy-From': fromContainer + '/' + sourceObject
    }
  }, callback);
};

// Move Object
Swift.prototype.moveObject = function(container, destObject, fromContainer, sourceObject, callback) {
  var self = this;
  //if (container == fromContainer) return callback('move error');
  self.copyObject(container, destObject, fromContainer, sourceObject, function(err, result) {
    self.deleteObject(fromContainer, sourceObject, function(err, result) {
      callback(err, result);
    });
  });
};

module.exports = Swift;
