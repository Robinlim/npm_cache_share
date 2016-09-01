/**
* @Author: robin
* @Date:   2016-08-17 19:03:55
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-18 14:53:29
*/

var express = require('express');
var path = require('path');
var fs = require('fs');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');

// 初始化express
var app = express();

// 如果存在版本文件,则初始化版本号，ref/ver为版本号存放目录,版本文件形式与fekit保持一致
var versionPath = path.join(__dirname, 'ref/ver/versions.mapping'),
    versions = [];
if(fs.existsSync(versionPath)){
    fs.readFileSync(versionPath, 'utf-8')
    .split('\n').forEach(function(item) {
        var r = item.split('#');
        versions[r[0]] = r[1];
    });
}

app.use(favicon(__dirname + '/favicon.ico'));
app.enable('trust proxy');

//支持上传文件
app.use(bodyParser({ uploadDir: path.join(__dirname, 'filesTmp'), keepExtensions: true }));
// 让post请求实体增大
app.use(bodyParser.json({limit: '200mb'}));
app.use(bodyParser.urlencoded({limit: '200mb', extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());

// healthcheck
app.get('/healthcheck.html', function(req, res) {
    /* 使用healthcheck.html文件，由发布系统通过写入／删除该文件决定上下线 */
    var healthcheck = path.join(__dirname, 'healthcheck.html');
    try {
        fs.accessSync(healthcheck, fs.R_OK);
    } catch(e) {
        // 不存在或不可读返回404
        res.statusCode = 404;
        res.end('');
        return;
    }
    // 存在返回healthcheck.html内容
    var cont = fs.readFileSync(healthcheck).toString();
    res.end(cont);
});

module.exports = app;
