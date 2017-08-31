'use strict'
var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    utils = require('../../../common/utils'),
    CACHESTRATEGY = require('../../../common/constant').CACHESTRATEGY;

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
        res.render('strategy', {
            modules: this.packageList.list()
        });
    },
    /*@RequestMapping("/strategy/api/list")*/
    /*@ResponseBodyDeal*/
    list: function(req, res){
        res.end({
            status: 200,
            modules: this.packageList.list()
        });
    },
    /*@RequestMapping("/strategy/api/add")*/
    /*@ResponseBodyDeal*/
    add: function(req, res, reqData){
        var name = reqData.moduleName,
            strategy = reqData.strategy;
        if(!strategy[CACHESTRATEGY.ALWAYSUPDATE]
            && !strategy[CACHESTRATEGY.IGNORECACHE]
            && !strategy[CACHESTRATEGY.POSTINSTALL]){
            res.end({
                status: 400,
                message: '模块策略不能为空'
            });
            return;
        }
        //添加模块策略
        this.packageList.add(name, strategy, function(err){
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
            moduleStragety = this.packageList.list();
        if(!moduleStragety){
            res.end({
                status: 500,
                errmsg: '不存在该缓存策略'
            });
            return;
        }
        this.packageList.remove(name, function(err){
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
        return;
    },
    /*@ExceptionHandler*/
    /*@ResponseBodyDeal*/
    error: function(err, req, res){
        console.info(err.stack);
        res.status(500).end(err.message || err.stack || err);
    }
}