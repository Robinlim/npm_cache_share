/**
* 流程控制
* @Author: robin
* @Date:   2016-08-08 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-19 17:54:10
*/

'use strict';
var async = require('async');
var _ = require('lodash');

/*@AutoLoad()*/
var Flow = module.exports = require('node-annotation').Annotation.extend({
    /**
     * business realization
     * @return
     */
    execute: function() {
        var steps = {},
            model,
            funct,
            dependency,
            done = [],
            instance = this.model.instance();
        //获取流程步骤和结束行为
        this.traverse(function(i, item){
            model = item.model;
            funct = _.bind(instance[model.vo()], instance);
            if(model.name() == "Done"){
                done.push(funct);
                return;
            }
            if(dependency = model.po()){
                if(typeof dependency == 'string'){
                    dependency = [dependency];
                }
                dependency.push(funct);
            }
            steps[model.vo()] = dependency ? dependency : funct;
        });
        //添加启动方法
        instance.start = function(){
            async.auto(steps, function(err, results){
                if(err){
                    console.error(err);
                    return;
                }
                _.each(done, function(cb){
                    cb.call(instance, err, results);
                });
            });
        }
    }
}, {
    name: 'Flow'
});
