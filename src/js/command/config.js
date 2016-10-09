/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-09 11:44
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-09 11:49
*/

var fs = require('fs'),
    fsExtra = require('fs-extra'),
    utils = require('../common/utils'),
    constant = require('../common/constant');

/*@Command({"name": "config [action] [key] [value]", "alias":"f", "des":"Set config for npm cache", options:[]})*/
module.exports = {
    run: function(action, key, value, opts) {
        this.configPath = utils.getConfigPath();
        this.config = fsExtra.readJsonSync(this.configPath);
        if(key && constant.CONFIGKEY.indexOf(key) < 0){
            console.error('非法的配置键值:', key);
            process.exit(1);
        }
        switch(action){
            case 'set':
                this.config[key] = value;
                fsExtra.writeJsonSync(this.configPath, this.config);
                break;
            case 'get':
                console.log(this.config[key]);
                break;
            case 'list':
                console.log(this.config);
                break;
            case 'delete':
                delete this.config[key];
                fsExtra.writeJsonSync(this.configPath, this.config);
                break;
            default:
                console.error('非法的配置操作:', action);
        }
        process.exit();
    }
}
