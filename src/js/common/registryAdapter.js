var nexusRegistry = require('../registry/nexus'),
    nodeRegistry = require('../registry/node');

module.exports = function(opts){
    var type = opts.type;
    delete opts.type;
    switch (type) {
        case 'nexus':
            var repository = opts.registry,
                authArr = opts.auth.split(':'),
                auth = {
                    user: authArr[0],
                    password: authArr[1]
                };
            delete opts.registry;
            delete opts.auth;
            return new nexusRegistry({
                repository: repository,
                auth: auth
            });
            break;
        case 'node':
            var server = opts.registry,
                token = opts.token;
            delete opts.registry;
            delete opts.token;
            return new nodeRegistry({
                server: server,
                token: token
            });
            break;
        default:
            return null;
    }
}
