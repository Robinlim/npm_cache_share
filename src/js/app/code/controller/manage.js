'use strict'
var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    utils = require('../../../common/utils');

require('shelljs/global');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt();

var storage = require('../storage'),
    renderTool = require('../../widget/render');

/*@Controller*/
module.exports = {
    /*@RequestMapping("/")*/
    redirect: function(req, res){
        res.redirect('/repository')
    },
    /*@RequestMapping(["/manage/createRepository/{repository}"])*/
    createRepository: function(repository, req, res){
        storage.createRepository(repository, function(err){
            if(err) {
                res.statusCode(500).end(err);
            } else {
                res.end('success!');
            }
        });
    },
    /*@RequestMapping(["/manage/sync"])*/
    sync: function(req, res){
        storage.sync();
        res.end('已触发同步！');
    },
    /*@RequestMapping(["/repository"])*/
    repository: function(req, res){
        var fileList = _.map(storage.listRepository(), function(v, k){
            return {name: v.name, stat: v.stat, icon: 'drive'}
        });
        renderTool.renderDirectory({
            title: 'repository',
            fileList: fileList,
            backpath: '/repository',
            backname: 'repository',
            view: 'details'
        }, res);
    },
    /*@RequestMapping("/repository/{repository}")*/
    modules: function(req, res, repository){
        var fileList = _.map(storage.listModules(repository), function(v, k){
            return {name: v, icon: 'folder'}
        });
        renderTool.renderDirectory({
            title: repository,
            fileList: fileList,
            backpath: '/repository',
            backname: repository
        }, res);
    },
    /*@RequestMapping("/repository/{repository}/{name}")*/
    packages: function(req, res, repository, name){
        var name = decodeURIComponent(name),
            fileList = _.map(storage.listPackages(repository, name), function(v, k){
            return {name: v, icon: 'box'}
        });
        renderTool.renderDirectory({
            title: name,
            fileList: fileList,
            backpath: '/repository/' + repository,
            backname: name
        }, res);
    },
    /*@RequestMapping("/repository/{repository}/{name}/{subname}")*/
    info: function(req, res, repository, subname){
        var filename = decodeURIComponent(subname);
        var stat = storage.listPackageInfo(repository, filename, function(err, stat){
            if(err){
                res.status(404).end(err);
            } else {
                renderTool.renderInfo({
                    name: filename,
                    stat: stat,
                    repository: repository
                }, res);
            }
        });
    },
    /*@RequestMapping("/download/{repository}/{name}")*/
    download: function(req, res, repository, name){
        var filename = decodeURIComponent(name);
        storage.get(repository, filename, res);
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        console.log(err.stack);
        res.status(500).end(err.message || err);
    }
}
