/**
* @Author: wyw.wang <wyw>
* @Date:   2016-11-01 10:33
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-11-01 10:33
*/


var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    readline = require('readline'),
    checkUtils = require('./checkUtils'),
    npmUtils = require('./npmUtils'),
    utils = require('./utils');

var NPMSHRINKWRAP = 'npm-shrinkwrap.json',
    PACKAGELOCK = 'package-lock.json',
    YARNLOCKFILE = 'yarn.lock',
    VERSIONSTART = /^[0-9]+/;  

module.exports = {
    readManifest: function(base, name, cbk){
        var npmShrinkwrapPath = path.resolve(base, NPMSHRINKWRAP),
            packageLockPath = path.resolve(base, PACKAGELOCK),
            yarnLockfilePath = path.resolve(base, YARNLOCKFILE),
            pkgJson = fsExtra.readJsonSync(path.resolve(base, 'package.json'));
        // 未指定依赖时尝试用npm-shrinkwrap.json或yarn.lock
        if(!name){
            if(fs.existsSync(npmShrinkwrapPath)){
                parseNpmShrinkwrap(npmShrinkwrapPath, pkgJson, NPMSHRINKWRAP, cbk);
            }else if(fs.existsSync(packageLockPath)){ 
                parseNpmShrinkwrap(packageLockPath, pkgJson, PACKAGELOCK, cbk);
            }else if(fs.existsSync(yarnLockfilePath)){
                parseYarnLockfile(yarnLockfilePath, pkgJson, cbk);
            } else {
                console.warn('缺少npm-shrinkwrap.json或者yarn.lock，并且未指定其lockfile，此次安装将直接使用' + (npmUtils.checkYarn ? 'yarn' : 'npm') + ' install');
                cbk();
            }
        } else {
            var manifestPath = path.resolve(base, name);
            if(!fs.existsSync(manifestPath)){
                cbk('Cannot find path '+manifestPath+',check your --lockfile option!');
            }
            if(name === YARNLOCKFILE){
                parseYarnLockfile(manifestPath, pkgJson, cbk);
            } else {
                //  所有非 yarn.lock  均采用shrinkwrap方式解析
                parseNpmShrinkwrap(manifestPath, pkgJson, name, cbk);
            }
        }
    }
}

function parseNpmShrinkwrap(filepath, pkgJson, name, cbk){
    console.info('将读取'+name+'获取依赖');
    var shrinkwrap;
    try {
        shrinkwrap = fsExtra.readJsonSync(filepath);
        checkUtils.npmShrinkwrapCheck(pkgJson, shrinkwrap);
        regVersion(shrinkwrap);
    } catch (e) {
        cbk(e);
        return;
    }
    cbk(null, shrinkwrap.dependencies);
}


function parseYarnLockfile(filepath, pkgJson, cbk){
    console.info('将读取'+YARNLOCKFILE+'获取依赖');
    var toplevelModules = {},    //第一层依赖,版本都固化的
        conflictModules = {},    //第一层有重复的模块，每个模块里都有多个版本，且有max属性，表示该模块里最大引用数的版本
        solidModuleVersMap = {}, //固化版本信息，每个里面都有count属性，代表该模块版本的引用数
        rangModuleVersMap = {},  //非固化版本信息：对应的固化版本
        moduleInfo = null, tmp;
        
    var NAMEREG = /\"?(@?[^\@]+)\@/,
        VERSIONREG = /\s*version "([^"]*)"/,
        DEPENDREG = /\s*dependencies:/,
        KVREG = /\s*"?([^\s"]*)"?\s*"([^"]*)"/;
    
    var rl = readline.createInterface({
            input: fs.createReadStream(filepath)
    }).on('line', function(line){
        // 模块开始
        if(!moduleInfo){
            // 非注释非缩进且包含：的行 为依赖名称行
            if(line[0] !== '#' && line[0] !== ' ' && line[line.length-1] === ':'){
                var name = line.match(NAMEREG)[1]; 
                moduleInfo = {
                    name: name,
                    ranges: _.map(line.slice(0, -1).split(','), function(s){
                        // 去除首尾的空格和双引号
                        return _.trim(_.trim(s), '"');
                    }),
                    count: 0
                };
            }
        // 模块结束, 一个依赖块可能没有子依赖直接结束
        } else if(_.trim(line).length == 0){
            // 空行代表一个依赖块的结束 
            if(toplevelModules[moduleInfo.name] || conflictModules[moduleInfo.name]){
                tmp = (conflictModules[moduleInfo.name] = conflictModules[moduleInfo.name] || {});
                tmp[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
                if(toplevelModules[moduleInfo.name]){
                    tmp[toplevelModules[moduleInfo.name].name + '@' + toplevelModules[moduleInfo.name].version] = toplevelModules[moduleInfo.name];
                    toplevelModules[moduleInfo.name] = null;
                    delete toplevelModules[moduleInfo.name];
                }
            }else{
                toplevelModules[moduleInfo.name] = moduleInfo;
            }
            solidModuleVersMap[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
            moduleInfo = null;
        // 模块信息，只取关注的信息
        }else {
            // 优先判断是否已经存在依赖信息
            if(moduleInfo.dependencies){
                // 处理依赖模块信息
                var match = line.match(KVREG);
                if(match){
                    moduleInfo.dependencies[match[1] + '@' + match[2]] = {
                        name: match[1],
                        version: match[2]
                    };
                }
            }else{
                // 先取模块版本信息
                var match = line.match(VERSIONREG);
                if(match){
                    moduleInfo.version = match[1];
                    // 获得所有非固化版本 => 固化版本
                    _.forEach(moduleInfo.ranges, function(range){
                        rangModuleVersMap[range] = match[1];
                    });
                } else {
                    // 再取模块依赖标识，代码模块依赖开始
                    match = line.match(DEPENDREG);
                    if(match){
                        moduleInfo.dependencies = {};
                        return;
                    }
                }
            }
        }
    }).on('close', function(){
        // 文件结束后moduleInfo应该未空，未为空的场景下需要添加到dependenceArr
        if(moduleInfo){
            if(toplevelModules[moduleInfo.name] || conflictModules[moduleInfo.name]){
                tmp = (conflictModules[moduleInfo.name] = conflictModules[moduleInfo.name] || {});
                tmp[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
                if(toplevelModules[moduleInfo.name]){
                    tmp[toplevelModules[moduleInfo.name].name + '@' + toplevelModules[moduleInfo.name].version] = toplevelModules[moduleInfo.name];
                    toplevelModules[moduleInfo.name] = null;
                    delete toplevelModules[moduleInfo.name];
                }
            }else{
                toplevelModules[moduleInfo.name] = moduleInfo;
            }
            solidModuleVersMap[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
            moduleInfo = null;
        }
        
        // 构建整体依赖树，最终生成toplevelModules，此时dependencies固化后没有处理子依赖
        _.forEach(solidModuleVersMap, function(mi){
            buildDependencies(mi);
        });
        // 不改变原有依赖层级，因为存在peerDependencies，有关联绑定的模块存在
        // 处理多版本模块，构建至topLevelModules
        _.forEach(conflictModules, function(v,k){
            buildConflictModules(v, k);
        });

        // 根据top层构建依赖树
        _.forEach(toplevelModules, function(v,k){
            v && buildTopModules(v, k, '');
        });
        
        checkUtils.yarnLockCheck(pkgJson, {
            dependencies: toplevelModules
        });

        cbk(null, _.cloneDeep(toplevelModules));
    });

    // 完善固化版本的依赖，并生成toplevelModules
    function buildDependencies(mi){
        var dependencies = mi.dependencies, tmp, name, index;
        _.forEach(dependencies, function(v, k){
            dependencies[v.name] = {
                name: v.name,
                from: k,
                version: rangModuleVersMap[k]
            };
            dependencies[k] = null;
            delete dependencies[k];

            name = v.name + '@' + rangModuleVersMap[k];
            tmp = conflictModules[v.name];
            //处理有多版本依赖的模块，记住依赖关系，方便后续操作删除
            if(tmp && tmp[name]){
                (tmp[name].requires = tmp[name].requires || []).push(dependencies);
            }else{
                //如果依赖是在第一层，则删除该依赖引用
                tmp = toplevelModules[v.name];
                if(tmp){
                    index = tmp.ranges.indexOf(v.version) || -1;
                    if(tmp.version == rangModuleVersMap[k]){
                        (tmp.requires = tmp.requires || []).push(dependencies);
                        dependencies[v.name] = null;
                        delete dependencies[v.name];
                    }
                    if(index != -1){
                        tmp.ranges.splice(index, 1);
                    }
                }
            }
        });
    }

    // 多版本模块决定哪个版本在顶部
    function buildConflictModules(moduleInfo, moduleName){
        var max = {count:0, top: null}, count;
        _.forEach(moduleInfo, function(v, k){
            count = v.requires && v.requires.length || 0;
            if(count == 0 || v.ranges.indexOf([moduleName, pkgJson.dependencies[moduleName] || pkgJson.devDependencies[moduleName]].join('@')) != -1){
                max.top = v;
            }else if(count > max.count){
                max.count = count;
                max.module = v;
            }
        });
        //top代表本身就是第一层，否则将最多引用次数版本放入toplevelModules，并删除该模块需求的引用
        if(max.top){
            toplevelModules[max.top.name] = max.top;
        }else{
            toplevelModules[max.module.name] = max.module;
            _.forEach(max.module.requires, function(v){
                v[max.module.name] = null;
                delete v[max.module.name];
            });
        }
    }

    // 替换top层的依赖，modulesPath用于判断递归路径中是否存在循环，由于是解析固化后的文件，所以不考虑
    // 儿子层级和孙子层级出现重复的版本模块
    function buildTopModules(moduleInfo, moduleName, modulesPath){
        var dependencies = moduleInfo.dependencies;
        if(!_.isEmpty(dependencies)){
            var tmp;
            _.forEach(dependencies, function(v, k){
                tmp = k + '@' + v.version;
                if(modulesPath.indexOf(tmp) != -1){
                    dependencies[k] = null;
                    delete dependencies[k];
                    return;
                }
                dependencies[k] = solidModuleVersMap[tmp];
                buildTopModules(dependencies[k], k, [modulesPath, tmp].join('|'));
            });
        }
        
        if((moduleInfo.requires || []).length == 1 && moduleInfo.ranges.length == 1 && 
                modulesPath.length == 0 && !pkgJson.dependencies[moduleName] && 
                !(pkgJson.devDependencies && pkgJson.devDependencies[moduleName])){
            moduleInfo.requires[0][moduleName] = moduleInfo;
            // toplevelModules[moduleName] = null;
            // delete toplevelModules[moduleName];
        }
    }
}

/**
 * 由于npm5生成的npm-shrinkwrap.json里的格式变更，需要适配
 * @param {*} shrinkwrap 
 */
function regVersion(shrinkwrap){
    //npm5就开始存在lockfileVersion，用来判断shrinkwrap的版本
    if(!shrinkwrap.lockfileVersion){
        return shrinkwrap;
    }
    utils.traverseDependencies(shrinkwrap.dependencies, function(v, k){
        if(!v.version || VERSIONSTART.test(v.version)){
            return;
        }
        var ver = utils.hasNpmVersion(v.version);
        if(!ver){
            //所有不识别的版本都进行输出，作为新模块进行安装，如
            //git+ssh://git@gitlab.corp.qunar.com:qrn/qrn-web.git#e365ff30053d0a790e172d379f4eb1338e752461
            //http://xxx.com/xxx.tar.gz
            //file:../xx
            console.info(k + "@" + v.version + " is not a supported format, but still be installed!!!");
        }else{
            v.version = ver[1] || ver[3];
        }
    });
}