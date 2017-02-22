/**
* @Author: wyw.wang <wyw>
* @Date:   2017-02-21 18:56
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2017-02-21 18:56
*/



var _ = require('lodash'),
    path = require('path'),
    fsExtra = require('fs-extra');

var CONFIG_FILE = 'package.json',
    CONFIG_KEY = 'qzzConfig',
    SPLITER = '_';

var Config = function(cwd, config){
    console.debug('qzzConfig:', config);
    this.cwd = cwd;
    this.multi = false;
    if ((typeof config.path) === 'undefined'){
        this.multi = true;
        var configs = [];
        for(var k in config){
            var el = config[k];
            configs.push({
                project: k,
                version: el.version,
                path: el.path
            });
        }
        this.configs = configs;
    } else {
        this.multi = false;
        this.project = config.project;
        this.version = config.version;
        this.path = config.path;
    }
};

Config.prototype.format = function(){
    var self = this;
    if(this.multi){
        return _.flatMap(this.configs, function(el){
            return {
                name: el.project + SPLITER + el.version,
                path: path.join(self.cwd, el.path)
            };
        });
    } else {
        return {
            name: this.project + SPLITER + this.version,
            path: path.join(this.cwd, this.path)
        }
    }
};

module.exports = {
    getConfig: function(cwd){
        var content = fsExtra.readJsonSync(path.join(cwd, CONFIG_FILE)),
            config = content[CONFIG_KEY];
        if((typeof config) === 'undefined'){
            throw new Error('Can`t find ' + CONFIG_KEY + ' in ' + CONFIG_FILE);
        } else {
            return new Config(cwd, config);
        }
    }
};
