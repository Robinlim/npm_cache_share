/**
* @Author: wyw.wang <wyw>
* @Date:   2016-09-14 15:48
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-09-14 15:49
*/


var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    utils = require('../../common/utils');

var cache = {};

var ignoreDir = ['.tempdir'];

module.exports = {
    /**
     * 装载并监控缓存目录
     * @param  {path} base 目录跟路径
     * @return {void}      [description]
     */
    init: function(base){
        var _cacheRepository = this._cacheRepository.bind(this);
        fs.readdir(base, function(err, files){
            _.forEach(files, function(file){
                if(ignoreDir.indexOf(file) < 0){
                    _cacheRepository(base, file);
                }
            });
        });
        fs.watch(base, function(event, filename){
            console.log('[watch]', base, event, filename);
            if(filename){
                _cacheRepository(base, filename);
            } else {
                // TODO? watch的第二个参数貌似又兼容性问题，待测试
                console.error('cannot get filename when watching file at', base);
            }
        });
    },
    /**
     * 缓存各个仓库
     * @param  {path} base 跟路径
     * @param  {string} name 仓库名称
     * @return {void}      [description]
     */
    _cacheRepository: function(base, name){
        var filepath = path.resolve(base, name),
            check = checkPath(filepath),
            stat;
        console.log('[file change]', check.type, filepath);
        if( (check.type === 'create')
            && (stat = check.stat)
            && stat.isDirectory() ){
            cache[name] = {
                name: name,
                stat: stat,
                modules: {}
            };
            this._traverseModule(name, filepath);
        } else if ( check.type === 'deleted' && cache[name]){
            delete cache[name];
        }
    },
    /**
     * 遍历仓库的每个模块
     * @param  {string} repository 仓库名称
     * @param  {path} dir        仓库所在路径
     * @return {void}            [description]
     */
    _traverseModule: function(repository, dir){
        var _cacheModule = this._cacheModule.bind(this);
        fs.readdir(dir, function(err, files){
            _.forEach(files, function(file){
                _cacheModule(dir, repository, file);
            });
        });
        fs.watch(dir, function(event, filename){
            console.log('[watch]', dir, event, filename);
            if(filename){
                _cacheModule(dir, repository, filename);
            } else {
                // TODO? watch的第二个参数貌似又兼容性问题，待测试
                console.error('cannot get filename when watching file at', base);
            }
        });
    },
    /**
     * 缓存每个模块（按模块名一级，之后再按照版本号一级）
     * @param  {path} dir        模块所在路径
     * @param  {string} repository 仓库名称
     * @param  {string} name       模块对应的文件名
     * @return {void}            [description]
     */
    _cacheModule: function(dir, repository, name){
        var filepath = path.join(dir, name),
            check = checkPath(filepath),
            modules = cache[repository].modules,
            moduleName = utils.splitModuleName(name),
            index;

        console.log('[file change]', check.type, filepath);
        if( check.type === 'create' ){

            if(!modules[moduleName]){
                modules[moduleName] = [];
            }
            if(modules[moduleName].indexOf(name) < 0){
                modules[moduleName].push(name);
            }
        } else if (check.type === 'delete'
            && cache[repository].modules[moduleName]
            && (index = modules[moduleName].indexOf(name)) > -1){
            modules[moduleName].splice(index,1);
            if(modules[moduleName].length === 0){
                delete modules[moduleName];
            }
        }
    },
    /**
     * 返回缓存全部内容
     * @return {Object} 缓存对象
     */
    listAll: function() {
        return cache;
    },
    /**
     * 返回仓库列表
     * @return {Array} 数组每项包含name，stat
     */
    listRepository: function(){
        return _.map(cache, function(v, k){
            return {name: k, stat: v.stat};
        });
    },
    /**
     * 返回模块列表
     * @param  {string} repository 仓库名称
     * @return {Array}            数组每项为模块名（不含版本号以及环境）
     */
    listModules: function(repository){
        return _.keys(cache[repository].modules);
    },
    /**
     * 返回模块下的包列表
     * @param  {string} repository 仓库名称
     * @param  {string} name       模块名
     * @return {Array}            数组每项为包名称（含版本号以及环境）
     */
    listPackages: function(repository, name){
        return cache[repository].modules[name];
    },
    /**
     * 返回一个模块包的文件stat
     * @param  {path} base       缓存跟路径
     * @param  {string} repository 仓库名称
     * @param  {string} name       包名称（含版本号以及环境）
     * @return {Object}            包文件的stat
     */
    listPackageInfo: function(base, repository, name){
        var stat = fs.statSync(path.join(base, repository, name));
        return stat;
    },
    /**
     * 比较需要的模块与缓存内容，返回缓存中存在的包名称
     * @param  {string} repository 仓库名称
     * @param  {Array} list       所需的模块列表（包含版本号，不含环境）
     * @param  {string} env        环境信息
     * @return {Array}            缓存存在的模块列表（包含版本号和环境）
     */
    diffPackages: function(repository, list, env){
        var modules = cache[repository].modules,
            hit = [];
        _.forEach(list, function(name){
            var moduleName = utils.splitModuleName(name),
                packages = modules[moduleName];
            if(!packages){
                return;
            }
            var fileExt = utils.getFileExt(),
                packageNameForPlatform = utils.joinPackageName(name, env) + fileExt,
                packageName = name + fileExt;
            if(packages.indexOf(packageNameForPlatform) > -1){
                hit.push(packageNameForPlatform);
            } else if (packages.indexOf(packageName) > -1){
                hit.push(packageName);
            }
        });
        return hit;
    }
};

/**
 * 检查一个文件的变化，
 * 如果是新增，返回｛type：‘create’，stat：文件stat｝，如果是删除，返回｛type：‘delete’，stat：undefined｝
 * @param  {path} filepath 文件路径
 * @return {Object}      [description]
 */
function checkPath(filepath){
    var stat,type = 'create';
    try {
        stat = fs.statSync(filepath);
    } catch (e) {
        if(e.code === 'ENOENT'){
            type = 'delete';
        } else {
            console.error(e);
        }
    }
    return {
        type: type,
        stat: stat
    }
}
