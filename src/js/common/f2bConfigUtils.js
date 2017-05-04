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

function Config(cwd, config, options, root){
    console.debug('f2b:', config);
    var configs = this.configs = [];

    this.cwd = cwd;

    if ((typeof config.path) === 'undefined'){
        for(var k in config){
            var el = config[k];
            configs.push({
                project: k,
                version: el.version,
                path: el.path,
                type: el.type
            });
        }
    } else {
        configs.push({
            project: config.project || root.name,
            version: config.version,
            path: config.path,
            type: config.type
        });
    }
};

Config.prototype.format = function(){
    var cwd = this.cwd;
    return _.flatMap(this.configs, function(el){
        return {
            container: el.project,
            name: el.project + Constant.SPLIT + el.version,
            path: path.join(cwd, el.path),
            compressType: el.type,
            destpath: el.path
        };
    });
};

var utils = module.exports = {
    getConfig: function(cwd, options){
        var content = fsExtra.readJsonSync(path.join(cwd, Constant.CONFIG_FILE)),
            config = content[Constant.CONFIG_KEY];
        if(typeof config === 'undefined'){
            throw new Error('Can`t find ' + Constant.CONFIG_KEY + ' in ' + Constant.CONFIG_FILE);
        } else {
            return new Config(cwd, config, options, content);
        }
    },
    checkName: function(name, nameReg){
        if(!nameReg){
            return;
        }
        if(!RegExp(nameReg).test(name)){
            throw new Error('命名不符合规则' + nameReg + '!!!');
        }
    }
};
