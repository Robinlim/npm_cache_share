/**
* @Author: wyw.wang <wyw>
* @Date:   2016-11-15 14:42
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-11-15 14:43
*/


var fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),
    fsExtra = require('fs-extra'),
    utils = require('./utils');

module.exports = {
    npmShrinkwrapCheck: function(base, shrinkwrapJson){
        var pkgPath = path.resolve(base, 'package.json');
        if(fs.existsSync(pkgPath)){
            var pkgJson = fsExtra.readJsonSync(pkgPath),
                miss = diff(pkgJson.dependencies, shrinkwrapJson.dependencies);
            if(miss.length > 0){
                console.error('校验npm-shrinkwrap.json和package.json的依赖一致性失败');
                throw new Error('npm-shrinkwrap.json中缺少package.json中的以下依赖：' + miss.join(','));
            } else {
                console.info('校验npm-shrinkwrap.json和package.json的依赖一致性成功');
            }
        } else {
            console.info('未找到package.json，跳过依赖一致性校验。');
        }
    },
    yarnLockCheck: function(base, lockJson){
        var pkgPath = path.resolve(base, 'package.json');
        if(fs.existsSync(pkgPath)){
            var pkgJson = fsExtra.readJsonSync(pkgPath),
                miss = diff(pkgJson.dependencies, lockJson.dependencies);
            if(miss.length > 0){
                console.error('校验yarn.lock和package.json的依赖一致性失败');
                throw new Error('yarn.lock中缺少package.json中的以下依赖：' + miss.join(','));
            } else {
                console.info('校验yarn.lock和package.json的依赖一致性成功');
            }
        } else {
            console.info('未找到package.json，跳过依赖一致性校验。');
        }
    },
    snapshotDepsCheck: function(dependencies){
        var deps = [];
        utils.traverseDependencies(dependencies, function(v, k){
            if(utils.isSnapshot(v.version || v)){
                deps.push(k + ': ' + (v.version || v));
            }
        });
        if(deps.length > 0){
            throw new Error('依赖中含有SNAPSHOT模块：' + deps.join(','));
        }
    }
};

function diff(source, dist){
    if(!source){
        return [];
    }
    var missing = [];
    _.each(source, function(v, k){
        if(!dist[k]){
            missing.push(k);
        }
    });
    return missing;
}
