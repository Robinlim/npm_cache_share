/**
* @Author: wyw.wang <wyw>
* @Date:   2016-12-07 16:53
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-12-07 16:54
*/

var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    constant = require('../../../common/constant'),
    utils = require('../../../common/utils');

var serverCachePath = utils.getServerCachePath(),
    packageListName = 'packageList.json',
    packageListPath = path.join(serverCachePath, packageListName);

var _map = {};

module.exports = {
    load: function(){
        if(fs.existsSync(packageListPath)){
            _map = fsExtra.readJsonSync(packageListPath);
        }
    },
    add: function(name, info){
        console.log('[synclist] change', name, info);
        _map[name] = info;
        this.save();
    },
    save: function(){
        fsExtra.writeJsonSync(packageListPath, _map);
    },
    diffSync: function(list){
        var hit = {};
        _.forEach(list, function(el){
            var name = utils.splitModuleName(el);
            if(_map[name] && _map[name].alwaysSync){
                hit[el] = constant.ALWAYS_SYNC_FLAG;
            }
        });
        return hit;
    },
    checkPrivate: function(name){
        return _map[name] && _map[name].isPrivate;
    }
}
