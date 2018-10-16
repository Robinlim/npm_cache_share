/**
* @Author: robin
* @Date:   2016-08-17 19:03:55
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:13:46
*/

var express = require('express');
var path = require('path');
var fs = require('fs');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var utils = require('../common/utils');
// 初始化express
var app = express();
var env = process.env;
// 同步client的debug方法
require('../common/console');
global.DEBUG = env.DEBUG == 'true';

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(favicon(__dirname + '/favicon.ico'));
app.enable('trust proxy');

// 让post请求实体增大
app.use(bodyParser.json({limit: '200mb'}));
app.use(bodyParser.urlencoded({limit: '200mb', extended: true, parameterLimit: 20000}));
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

//初始化缓存
require('./code/cache').ready().then(function(){
    //初始化存储
    require('./code/storage').init(
        env.storage, env.storageConfig, 
        env.storageSnapshotConfig || env.storageConfig, 
        env.swiftTokenTimeout,
        env);    
    //加载缓存策略
    require('./code/dao').load();
});

module.exports = app;
