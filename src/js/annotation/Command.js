/**
* 执行指令
* @Author: robin
* @Date:   2016-08-08 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-23 17:32:51
*/

'use strict';
var nomnom = require("nomnom")
    .script("npm_cache_share")
    .options({
        clean: {
            position: 1,
            abbr: 'c',
            help: "Clear the local npm module cache"
        },
        server: {
            position: 2,
            abbr: 's',
            help: "Start a server to store the npm module cache"
        },
        install: {
            position: 3,
            abbr: 'i',
            help: "Install the module by npm-shrinkwrap.json"
        },
        help: {
            position: 4,
            abbr: 'h',
            help: "Helper"
        },
        service: {
            help: 'specify the server, like IP:PORT format'
        },
        register: {
            help: 'specify the npm origin'
        },
        production: {
            flag: true,
            help: 'will not install modules listed in devDependencies'
        },
        noOptional: {
            flag: true,
            help: 'argument will prevent optional dependencies from being installed'
        },
        forServer:{
            flag: true,
            help: 'use for clean command, default clean the npm cache in client, if the value is false, clean the npm cache in server'
        }
    });
/*@AutoLoad*/
var Command = module.exports = require('node-annotation').Annotation.extend({
    /**
     * compile the model
     * @param  {[Model]} model [annotation data]
     * @return
     */
    compile: function(model) {
        nomnom.command(model.po()).callback(function(options){
            model.instance()[model.vo()](options, nomnom);
        });
    }
}, {
    name: 'Command'
});
global.run = function() {
    nomnom.parse();
}
