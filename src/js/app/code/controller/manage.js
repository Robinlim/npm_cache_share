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
    /*@RequestMapping("/")*/
    redirect: function(req, res){
        res.redirect('/versionType')
    },
    /*@RequestMapping(["/manage/createRepository/{versionType}/{repository}"])*/
    createRepository: function(versionType, repository, req, res){
        storage.createRepository(isSnapshot(versionType), repository, function(err){
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
    /*@RequestMapping(["/versionType"])*/
    versionType: function(req, res){
        var fileList = [
            {name: 'snapshot', icon: 'drive'},
            {name: 'release', icon: 'drive'}
        ];
        renderTool.renderDirectory({
            title: 'versionType',
            fileList: fileList,
            backpath: '/versionType',
            backname: 'versionType',
            view: 'details'
        }, res);
    },
    /*@RequestMapping(["/versionType/{versionType}"])*/
    repository: function(versionType, req, res){
        var fileList = _.map(storage.listRepository(isSnapshot(versionType)), function(v, k){
            return {name: v.name, stat: v.stat, icon: 'folder'}
        });
        renderTool.renderDirectory({
            title: versionType,
            fileList: fileList,
            backpath: '/versionType',
            backname: versionType,
            view: 'details'
        }, res);
    },
    /*@RequestMapping("/versionType/{versionType}/{repository}")*/
    modules: function(req, res, versionType, repository){
        var fileList = _.map(storage.listModules(isSnapshot(versionType), repository), function(v, k){
            return {name: v, icon: 'folder'}
        });
        renderTool.renderDirectory({
            title: repository,
            fileList: fileList,
            backpath: '/versionType/' + versionType,
            backname: repository,
            view: 'repository'
        }, res);
    },
    /*@RequestMapping("/versionType/{versionType}/{repository}/{name}")*/
    packages: function(req, res, versionType, repository, name){
        var fileList = _.map(storage.listPackages(isSnapshot(versionType), repository, decodeURIComponent(name)), function(v, k){
            return {name: v, icon: 'box'}
        });
        renderTool.renderDirectory({
            title: name,
            fileList: fileList,
            backpath: '/versionType/' + versionType + '/' + repository,
            backname: name
        }, res);
    },
    /*@RequestMapping("/versionType/{versionType}/{repository}/{name}/{subname}")*/
    info: function(req, res, versionType, repository, subname){
        var filename = decodeURIComponent(subname);
        storage.listPackageInfo(isSnapshot(versionType), repository, filename, function(err, stat){
            if(err){
                res.status(err.statusCode || 404).end(err.message || err.stack || err);
            } else {
                renderTool.renderInfo({
                    name: subname,
                    stat: stat,
                    repository: repository,
                    versionType: versionType
                }, res);
            }
        });
    },
    /*@RequestMapping("/download/{versionType}/{repository}/{name}")*/
    download: function(req, res, repository, name){
        var filename = decodeURIComponent(name);
        storage.get(repository, filename, res);
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        console.info(err.stack);
        res.status(500).end(err.message || err);
    }
}

function isSnapshot(versionType) {
    return versionType.toUpperCase() == constant.VERSION_TYPE.SNAPSHOT;
}
