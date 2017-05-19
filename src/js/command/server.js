/**
 * @Author: robin
 * @Date:   2016-08-17 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-18 11:06:07
 */

'use strict'
var _ = require('lodash'),
    path = require('path'),
    utils = require('../common/utils'),
    shellUtils = require('../common/shellUtils'),
    fsExtra = require('fs-extra'),
    childProcess = require('child_process');

var constant = require('../common/constant'),
    app = path.join(__dirname, '../app'),
    pm2OpsMap = constant.PM2OPS;

/*@Command({
    "name": "server [command] [name]",
    "alias":"s",
    "des":"Start a server to store the npm module cache, command is for pm2, like start、stop、restart，and so on， name mean the name of application for pm2.",
    options:[
        ["-s, --storage [storage]", "specify the type of storage, could be localfile or swift"],
        ["-c, --storageConfig [storageConfig]", "specify the config of storage, serveral arguments joined with '|', the format of swift is 'host|user|pass', localfile is 'cache path'"],
        ["-p, --port [port]", "specify the port of the service, default is 8888"],
        ["-f, --useFork", "start with fork"],
        ["-t, --token [token]", "control the auth to access the server"],
        ["-i, --i [i]", "thread count only for pm2"],
        ["-n --name [name]", "app name only for pm2"]
    ]
})*/
module.exports = {
    run: function(command, name, opts) {
        var pm2 = shellUtils.which('pm2'),
            env = _.extend({        //进程传递参数
                port: opts.port || '8888',
                token: opts.token,   //请求校验
                storage: opts.storage || 'localfile',
                storageConfig: opts.storageConfig,
                storageSnapshotConfig: opts.storageSnapshotConfig || opts.storageConfig,
                zookeeper: opts.zookeeper,
                DEBUG: !!global.DEBUG
            }, process.env);
        // 没有pm2或者指定了useFork就使用fork子进程方式
        if (!pm2 || opts.useFork) {
            console.info('Connot find pm2, will start server with fork.');
            childProcess.fork(app, {
                env: env
            });
        } else {
            // 使用pm2管理server
            console.info(
                'Will start server with PM2. \n' +
                '- If you want to just start with fork ,use "--useFork" or "-f" option. \n' +
                '- You can append actions like "start/stop/list" and options like "--instances 4,etc." after.\n'
            );
            // 指令中的_，数字以及port参数之外的参数全部传给pm2
            var options =[];
            _.forIn(opts, function(value ,key){
                if(key[0] != '_' && typeof value != 'object' && typeof value != 'function' && typeof value != 'undefined' && pm2OpsMap[key]){
                    options.push((key.length == 1 ? '-' : '--') + key + ' ' + value);
                }
            });
            // 指令的第二个参数标示pm2的动作，默认start
            var cmd = [pm2,  command || 'start', name || app].concat(options).join(' ');
            console.info('exec:',cmd);
            shellUtils.exec(cmd, {
                env: env
            });
        }
    }
}
