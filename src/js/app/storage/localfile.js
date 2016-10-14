/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-11 18:04
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:29
*/

var _ = require('lodash'),
    fs = require('fs'),
    fsExtra = require('fs-extra');


var cache = require('./cache');

/*@Factory("localfile")*/
function localfile(config){
    this.dir = config.dir;
    this.ignoreDir = ['.tempdir'];
}

localfile.prototype.init = function(){
    var self = this;
    fs.readdir(self.dir, function(err, files){
        _.forEach(files, function(file){
            if(self.ignoreDir.indexOf(file) < 0){
                _cacheRepository(self.dir, file);
            }
        });
    });
    fs.watch(self.dir, function(event, filename){
        console.log('[watch]', self.dir, event, filename);
        if(filename){
            _cacheRepository(self.dir, filename);
        } else {
            // TODO? watch的第二个参数貌似又兼容性问题，待测试
            console.error('cannot get filename when watching file at', self.dir);
        }
    });
}

/**
 * 缓存各个仓库
 * @param  {path} base 跟路径
 * @param  {string} name 仓库名称
 * @return {void}      [description]
 */
function _cacheRepositroy(base, name){
    var filepath = path.resolve(base, name),
        check = _checkPath(filepath),
        stat;
    console.log('[file change]', check.type, filepath);
    if( (check.type === 'create')
        && (stat = check.stat)
        && stat.isDirectory() ){
        cache.addRepository(name, stat);
        _traverseModule(name, filepath);
    } else if ( check.type === 'deleted'){
        cache.delRepository(name);
    }
}

/**
 * 遍历仓库的每个模块
 * @param  {string} repository 仓库名称
 * @param  {path} dir        仓库所在路径
 * @return {void}            [description]
 */
function _traverseModule(repository, dir){
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
}

/**
 * 缓存每个模块（按模块名一级，之后再按照版本号一级）
 * @param  {path} dir        模块所在路径
 * @param  {string} repository 仓库名称
 * @param  {string} name       模块对应的文件名
 * @return {void}            [description]
 */
function _cacheModule(dir, repository, name){
    var filepath = path.join(dir, name),
        check = _checkPath(filepath);

    console.log('[file change]', check.type, filepath);
    if( check.type === 'create' ){
        cache.addPackage(repository, name);
    } else if (check.type === 'delete'){
        cache.delPackage(repository, name);
    }
}


/**
 * 检查一个文件的变化，
 * 如果是新增，返回｛type：‘create’，stat：文件stat｝，如果是删除，返回｛type：‘delete’，stat：undefined｝
 * @param  {path} filepath 文件路径
 * @return {Object}      [description]
 */
function _checkPath(filepath){
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

localfile.prototype.check = function(){
    return true;
};

localfile.prototype.createRepository = function(repository, cbk){
    var dirpath = path.resolve(this.dir, repository);
    fs.mkdir(dirpath, cbk);
};

// localfile.prototype.listRepository = function(cbk){
//
// };
//
// localfile.prototype.listPackages = function(repository, cbk){
//
// };

localfile.prototype.get = function(repository, name, cbk){

};

localfile.prototype.put = function(repository, name, cbk){

};



module.exports = localfile;
