var nodeAnnotation = require('node-annotation'),
    path = require('path');

nodeAnnotation.start(path.resolve(__dirname, 'src'), function(){
    var app = require('./app');
    nodeAnnotation.app(app);
    var server = app.listen(process.env.port || '8888', function() {
        console.log('Express server listening on port %d', server.address().port);
    });
});
