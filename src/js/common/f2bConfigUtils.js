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
    Constant = require('./constant'),
    F2B = Constant['F2B'];
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
                type: el.type,
                ceph: options.ceph
            });
        }
    } else {
        configs.push({
            project: config.project || root.name,
            version: config.version,
            path: config.path,
            type: config.type,
            ceph: options.ceph
        });
    }
};

Config.prototype.format = function(withoutProject){
    var cwd = this.cwd;
    return _.flatMap(this.configs, function(el){
        return {
            container: el.project,
            name: withoutProject ? el.version : el.project + F2B.SPLIT + el.version,
            path: path.join(cwd, el.path),
            compressType: el.type || Constant.COMPRESS_TYPE.TAR,
            destpath: el.path,
            ceph: el.ceph
        };
    });
};

var utils = module.exports = {
    getConfig: function(cwd, options){
        var content = fsExtra.readJsonSync(path.join(cwd, F2B.CONFIG_FILE)),
            config = content[F2B.CONFIG_KEY];
        if(typeof config === 'undefined'){
            throw new Error('Can`t find ' + F2B.CONFIG_KEY + ' in ' + F2B.CONFIG_FILE);
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
