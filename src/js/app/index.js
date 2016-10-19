var nodeAnnotation = require('node-annotation'),
    path = require('path');


/**
 * 配置全局错误处理
 * [Function] 错误处理函数
 */
nodeAnnotation.setGlobalErrorHandler(function(err){
  console.error(err.stack || err);
});

/**
 * 配置node－annotation内的日志流出
 * [Boolean] 是否开启日志，默认true
 * [String] "error/warn/info/log" 输出日至级别，默认warn
 * [Function/LoggerObject] 日志处理函数或对象(类似log4js的Logger对象)，默认为console
 */
nodeAnnotation.setLogger(true, 'error', function(str, level) {
    console.error('[ERROR]', str);
});

nodeAnnotation.start(path.resolve(__dirname, 'src'), function(){
    var app = require('./app');
    nodeAnnotation.app(app);
    var server = app.listen(process.env.port || '8888', function() {
        console.log('Express server listening on port %d', server.address().port);
    });
});
