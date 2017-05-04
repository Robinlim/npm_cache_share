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
    /**
     * 加载包配置信息
     * @return {void} [description]
     */
    load: function(){
        if(fs.existsSync(packageListPath)){
            _map = fsExtra.readJsonSync(packageListPath);
        }
    },
    /**
     * 追加一个包的信息
     * @param {string} name 包名称
     * @param {json} info 包信息
     */
    add: function(name, info){
        console.log('[synclist] change', name, info);
        _map[name] = info;
        this.save();
    },
    /**
     * 固化包信息到文件
     * @return {void} [description]
     */
    save: function(){
        fsExtra.writeJsonSync(packageListPath, _map);
    },
    /**
     * 比较出需要同步的包
     * @param  {array} list 需要依赖包
     * @return {map}      需要同步的依赖包
     */
    diffSync: function(list){
        var hit = {};
        _.forEach(list, function(el){
            var name = utils.splitModuleName(el);
            //只要含有SNAPSHOT标示就算，由于存在本地会导致多机情况下实效，最低要保证SNAPSHOT版本的更新
            //TODO redis解决
            if((_map[name] && _map[name].alwaysSync) || utils.isSnapshot(el)){
                hit[el] = {
                    flag: constant.ALWAYS_SYNC_FLAG
                };
            }
        });
        return hit;
    },
    /**
     * 判断一个包是否是私有模块
     * @param  {string} name 包名称
     * @return {boolean}      [description]
     */
    checkPrivate: function(name){
        return _map[name] && _map[name].isPrivate;
    },
    /**
     * 判断对一个私有模块是否有权限
     * @param  {string} name     包名称
     * @param  {string} password 私钥
     * @return {boolean}          [description]
     */
    auth: function(name, password){
        if(_map[name] && _map[name].isPrivate && _map[name].password){
            return password === _map[name].password;
        } else {
            return true;
        }
    }
}
