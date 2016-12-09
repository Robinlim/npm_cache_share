/**
* @Author: wyw.wang <wyw>
* @Date:   2016-11-15 14:42
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-11-15 14:43
*/


var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra');

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
