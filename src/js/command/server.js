/**
 * @Author: robin
 * @Date:   2016-08-17 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-29 13:02:09
 */

'use strict'
var _ = require('lodash'),
    path = require('path'),
    utils = require('../common/utils'),
    childProcess = require('child_process');

require('shelljs/global');

var app = path.join(__dirname, '../app');

/*@Command("server")*/
module.exports = {
    run: function(opts) {
        var pm2 = which('pm2');
        var env =_.extend({
            port: opts.port || '8888'
        }, process.env);
        if (!pm2 || opts.useFork) {
            console.info('Connot find pm2, will start server with fork.');
            childProcess.fork(app, {
                env: env
            })
        } else {
            console.info(
                'Will start server with PM2. \n' +
                '- If you want to just start with fork ,use --useFork option. \n' +
                '- You can append actions like "start/stop/list" and options like "--instances 4,etc." after.\n'
            );
            var action = opts[1] || 'start';
            var options =[];
            _.forIn(opts, function(value ,key){
                if(key !== 'port' && key!== '_' && _.isNaN(_.toNumber(key))){
                    options.push((key.length==1?'-':'--')+key+' '+value);
                }
            });
            var cmd = [pm2, action, app].concat(options).join(' ');
            console.info('exec:',cmd);
            exec(cmd, {
                env: env
            });
        }
    }
}
