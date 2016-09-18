'use strict'
var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    utils = require('../../common/utils');

require('shelljs/global');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt();

var directory = require('../widget/directory'),
    renderTool = require('../widget/render');

directory.init(modulesCachePath);

/*@Controller*/
module.exports = {
    /*@RequestMapping("/")*/
    redirect: function(req, res){
        res.redirect('/repository')
    },
    /*@RequestMapping(["/repository"])*/
    repository: function(req, res){
        var fileList = _.map(directory.listRepository(), function(v, k){
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
        var fileList = _.map(directory.listModules(repository), function(v, k){
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
        var fileList = _.map(directory.listPackages(repository, name), function(v, k){
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
        var stat = directory.listPackageInfo(modulesCachePath, repository, filename);
        renderTool.renderInfo({
            name: filename,
            stat: stat,
            download_url: '/download/' + repository + '/' + subname
        }, res);
    },
    /*@RequestMapping("/download/{repository}/{name}")*/
    download: function(req, res, repository, name){
        var filename = decodeURIComponent(name),
            filepath = path.join(modulesCachePath, repository, filename);
        fs.access(filepath, fs.R_OK, function(err){
            if(err){
                res.status(404).end(filename + 'not exist!')
            } else {
                res.setHeader('modulename', filename);
                res.download(filepath);
            }
        });

    },
    /*@RequestMapping("/list")*/
    /*@ResponseBody*/
    list: function(req, res, reqData){
        if(reqData.repository){
            if(reqData.name){
                res.end(directory.listPackages(repository,name));
            } else {
                res.end(directory.listModules(repository));
            }
        } else {
            res.end(directory.listAll());
        }
    },
    /*@ExceptionHandler*/
    /*@ResponseBody*/
    error: function(err, req, res){
        console.log(err.stack);
        res.status(500).end(err.message || err);
    }
}
