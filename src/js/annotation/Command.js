/**
* 执行指令
* @Author: robin
* @Date:   2016-08-08 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-14 18:48:06
*/

'use strict';
var _ = require('lodash'),
    path = require("path"),
    fsExtra = require("fs-extra"),
    utils = require('../common/utils');

var programe = require("commander")
                .version(fsExtra.readJsonSync(path.resolve(__dirname,'../../../package.json')).version || '0.0.1')
                .usage('<commands> [options]');

var config = fsExtra.readJsonSync(utils.getConfigPath());

/*@AutoLoad*/
var Command = module.exports = require('node-annotation').Annotation.extend({
    /**
     * compile the model
     * @param  {[Model]} model [annotation data]
     * @return
     */
    compile: function(model) {
        var ops = model.po(),
            cmd = programe
                    .command(ops.name)
                    .usage(ops.usage)
                    .alias(ops.alias)
                    .description(ops.des)
                    .option('-d, --debug', 'print all information for debug')
                    .option('-g, --config [config]', 'use specific config path')
                    .action(function(){
                        try{
                            var opts = arguments[arguments.length-1];
                            // 设置全局debug选项
                            if(opts && opts.debug){
                                global.DEBUG = true;
                                console.debug('In debug mode, will print all information for debug');
                                //console.debug('Options:', opts);
                            }
                            opts = filter(opts);
                            var instance = model.instance();
                            if(opts.config){
                                config = fsExtra.readJsonSync(path.resolve(opts.config));
                            }
                            arguments[arguments.length-1] = _.extend(config, opts);
                            instance[model.vo()].apply(instance, arguments);
                        }catch(err){
                            if(err){
                                console.error(err.stack || err);
                                process.exit(1);
                            }
                        }
                    });
        (ops.options || []).forEach(function(v){
            cmd.option(v[0], v[1], v[2]);
        });
        //过滤command options的自有属性和方法，会和指令参数冲突
        function filter(options){
            var opts = {};
            _.map(options, function(v, k){
                if(k[0] !== '_' && typeof v != 'function'){
                    opts[k] = v;
                }
            });
            return opts;
        }
    }
}, {
    name: 'Command'
});

global.run = function() {
    // 默认打印帮助信息
    if (!process.argv.slice(2).length) {
        programe.help();
    }
    programe.parse(process.argv);
}
