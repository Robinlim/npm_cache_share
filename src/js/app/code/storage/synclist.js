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
    utils = require('../../../common/utils');

var serverCachePath = utils.getServerCachePath(),
    synclistName = 'synclist.json',
    synclistPath = path.join(serverCachePath, synclistName);

var _map = {};

module.exports = {
    load: function(){
        if(fs.existsSync(synclistPath)){
            _map = fsExtra.readJsonSync(synclistPath);
        }
    },
    add: function(name){
        if(!_map[name]){
            console.log('[synclist] add', name);
            _map[name] = 1;
            this.save();
        }
    },
    diff: function(list){
        var hit = {};
        _.forEach(list, function(el){
            if(_map[el]){
                hit[el] = 2;
            }
        });
        return hit;
    },
    save: function(){
        fsExtra.writeJsonSync(synclistPath, _map);
    }
}
