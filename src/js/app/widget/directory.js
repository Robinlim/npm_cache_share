/**
* @Author: wyw.wang <wyw>
* @Date:   2016-09-14 15:48
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-09-14 15:49
*/


var _ = require('lodash'),
    fs = require('fs'),
    path = require('path');

var cache = {};

var ignoreDir = ['.tempdir'];

module.exports = {
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
    _cacheModule: function(dir, repository, name){
        var filepath = path.join(dir, name),
            check = checkPath(filepath),
            modules = cache[repository].modules,
            index;

        var arr = name.split('@'),
            moduleName = arr[0] === '' ? arr[1] : arr[0];

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
    listAll: function() {
        return cache;
    },
    listRepository: function(){
        return _.map(cache, function(v, k){
            return {name: k, stat: v.stat};
        });
    },
    listModules: function(repository){
        return _.keys(cache[repository].modules);
    },
    listPackages: function(repository, name){
        return cache[repository].modules[name];
    },
    listPackageInfo: function(base, repository, name){
        var stat = fs.statSync(path.join(base, repository, name));
        return stat;
    }
};

function checkPath(path){
    var stat,type = 'create';
    try {
        stat = fs.statSync(path);
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
