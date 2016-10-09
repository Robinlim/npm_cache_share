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
                    .action(function(){
                        var instance = model.instance();
                        arguments[arguments.length-1] = _.extend(config, arguments[arguments.length-1]);
                        instance[model.vo()].apply(instance, arguments);
                    });
        (ops.options || []).forEach(function(v){
            cmd.option(v[0], v[1], v[2]);
        });
    }
}, {
    name: 'Command'
});

global.run = function() {
    programe.parse(process.argv);
}
