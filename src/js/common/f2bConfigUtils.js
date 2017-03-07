/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-21 18:56
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-02-27 18:56
*/



var _ = require('lodash'),
    path = require('path'),
    fsExtra = require('fs-extra'),
    Constant = require('./constant')['F2B'];

function Config(cwd, config){
    console.debug('f2b:', config);
    var configs = this.configs = [];

    if ((typeof config.path) === 'undefined'){
        for(var k in config){
            var el = config[k];
            configs.push({
                project: k,
                version: el.version,
                path: path.join(cwd, el.path)
            });
        }
    } else {
        configs.push({
            project: config.project,
            version: config.version,
            path: path.join(cwd, config.path)
        });
    }
};

Config.prototype.format = function(){
    return _.flatMap(this.configs, function(el){
        return {
            container: el.project,
            name: el.project + Constant.SPLIT + el.version,
            path: el.path
        };
    });
};

module.exports = {
    getConfig: function(cwd){
        var content = fsExtra.readJsonSync(path.join(cwd, Constant.CONFIG_FILE)),
            config = content[Constant.CONFIG_KEY];
        if(typeof config === 'undefined'){
            throw new Error('Can`t find ' + Constant.CONFIG_KEY + ' in ' + Constant.CONFIG_FILE);
        } else {
            return new Config(cwd, config);
        }
    }
};
