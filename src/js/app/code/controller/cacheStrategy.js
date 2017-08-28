'use strict'
var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    utils = require('../../../common/utils'),
    constant = require('../../../common/constant');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt();

var storage = require('../storage'),
    renderTool = require('../../widget/render');

/*@Controller*/
module.exports = {
    /*@Autowired("privatemodules")*/
    packageList: null,
    /*@RequestMapping("/strategy")*/
    strategy: function(req, res){
        // res.end({
        //     modules: this.packageList.list() || {}
        // });
        res.render('strategy', {
            modules: this.packageList.list()
        });
    },
    /*@RequestMapping("/strategy/api/add")*/
    /*@ResponseBodyDeal*/
    add: function(req, res, reqData){
        var name = reqData.moduleName,
            moduleStragety = this.packageList.list()[name];
        if(!moduleStragety){
            moduleStragety ={};
        }

        //添加模块策略
        moduleStragety[reqData.strategy] = reqData.value || 1;
        this.packageList.add(name, moduleStragety, function(err){
            if(err){
                res.end({
                    status: 500,
                    message: err.stack || err
                });
                return;
            }
            res.end({
                status: 200
            });
        });
    },
    /*@RequestMapping("/strategy/api/remove")*/
    /*@ResponseBodyDeal*/
    remove: function(req, res, reqData){
        var name = reqData.moduleName,
            moduleStragety = this.packageList.list()[name];
        if(!moduleStragety){
            res.end({
                status: 500,
                errmsg: '不存在该缓存策略'
            });
            return;
        }
        //删除该模块策略
        moduleStragety[reqData.strategy] = null;
        delete moduleStragety[reqData.strategy];
        //获取当前模块的策略数
        var len = _.keys(moduleStragety).length;
        //为0，就删除该模块
        if(len == 0){
            this.packageList.remove(name, function(err){
                rs(err);
            });
            return;
        }
        //否则更新模块策略
        this.packageList.add(name, moduleStragety, function(err){
            rs(err);
        });

        function rs(err){
            if(err){
                res.end({
                    status: 500,
                    message: err.stack || err
                });
                return;
            }
            res.end({
                status: 200
            });
        }
    },
    /*@ExceptionHandler*/
    /*@ResponseBodyDeal*/
    error: function(err, req, res){
        console.info(err.stack);
        res.status(500).end(err.message || err);
    }
}