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
    NPMVERSIONREG = /([0-9]+\.[0-9]+\.[\s\S]+?)(\.tgz|$)/,
    VERSIONSTART = /^[0-9]+/;

module.exports = {
    readManifest: function(base, name, cbk){
        var npmShrinkwrapPath = path.resolve(base, NPMSHRINKWRAP),
            packageLockPath = path.resolve(base, PACKAGELOCK),
            yarnLockfilePath = path.resolve(base, YARNLOCKFILE);
        // 未指定依赖时尝试用npm-shrinkwrap.json或yarn.lock
        if(!name){
            if(fs.existsSync(npmShrinkwrapPath)){
                parseNpmShrinkwrap(npmShrinkwrapPath, base, NPMSHRINKWRAP, cbk);
            }else if(fs.existsSync(packageLockPath)){ 
                parseNpmShrinkwrap(packageLockPath, base, PACKAGELOCK, cbk);
            }else if(fs.existsSync(yarnLockfilePath)){
                parseYarnLockfile(yarnLockfilePath, base, cbk);
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
                parseYarnLockfile(manifestPath, base, cbk);
            } else {
                //  所有非 yarn.lock  均采用shrinkwrap方式解析
                parseNpmShrinkwrap(manifestPath, base, name, cbk);
            }
        }
    }
}

function parseNpmShrinkwrap(filepath, dir, name, cbk){
    console.info('将读取'+name+'获取依赖');
    var shrinkwrap;
    try {
        shrinkwrap = fsExtra.readJsonSync(filepath);
        checkUtils.npmShrinkwrapCheck(dir, shrinkwrap);
        regVersion(shrinkwrap);
    } catch (e) {
        cbk(e);
        return;
    }
    cbk(null, shrinkwrap.dependencies);
}


function parseYarnLockfile(filepath, dir, cbk){
    console.info('将读取'+YARNLOCKFILE+'获取依赖');
    var toplevelModules = {},    //第一层依赖,版本都固化的，每个模块都有max属性，表示该模块里最大引用数的版本
        toplevelModulesVersion = {},
        solidModuleVersMap = {}, //固化版本信息，每个里面都有count属性，代表该模块版本的引用数
        rangModuleVersMap = {},  //非固化版本信息：对应的固化版本
        moduleInfo = null;
        
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
            toplevelModules[moduleInfo.name] = solidModuleVersMap[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
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
            toplevelModules[moduleInfo.name] = solidModuleVersMap[moduleInfo.name + '@' + moduleInfo.version] = moduleInfo;
            moduleInfo = null;
        }

        // 构建整体依赖树，最终生成toplevelModules，此时dependencies固化后没有处理子依赖
        _.forEach(solidModuleVersMap, function(mi){
            buildDependencies(mi);
        });
        
        // 处理toplevelModules dependencies的子依赖
        _.forEach(toplevelModules, function(v, k){
            buildTopLevelDependencies(v);
        });

        console.info(JSON.stringify(toplevelModules));

        checkUtils.yarnLockCheck(dir, {
            dependencies: toplevelModules
        });
        cbk(null, _.cloneDeep(toplevelModules));
    });

    // 设置模块依赖入口和模块各版本控制，version为具体版本，非区间版本
    function setTopLevelModules(moduleName, version){
        var mversion = [moduleName, version].join('@'),
            mi = solidModuleVersMap[mversion],
            tmi = toplevelModulesVersion[moduleName] = toplevelModulesVersion[moduleName] || { max: 0 };
        mi.count++;
        if(mi.count > tmi.max){
            toplevelModules[moduleName] = {
                version: mi.version,
                dependencies: mi.dependencies,
                from: mi.from
            };
            tmi.max = mi.count;
            tmi.version = version;
        }
    }

    // 完善固化版本的依赖，并生成toplevelModules
    function buildDependencies(mi){
        var dependencies = mi.dependencies;
        _.forEach(dependencies, function(v, k){
            dependencies[v.name] = {
                name: v.name,
                from: k,
                version: rangModuleVersMap[k]
            };
            dependencies[k] = null;
            delete dependencies[k];
            setTopLevelModules(v.name, rangModuleVersMap[k]);
        });
    }

    // 处理toplevelModules dependencies的子依赖
    function buildTopLevelDependencies(mi){
        var dependencies = {}, tmp;
        _.forEach(mi.dependencies || {}, function(v, k){
            if(!toplevelModulesVersion[v.name] || toplevelModulesVersion[v.name].version != v.version){
                tmp = solidModuleVersMap[[v.name, v.version].join('@')];
                v = dependencies[v.name] = {
                    version: tmp.version,
                    from: tmp.from,
                    dependencies: tmp.dependencies
                };
                if(v.dependencies){
                    buildTopLevelDependencies(v);
                }
            }
        });
        mi.dependencies = dependencies;
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
        v.version = NPMVERSIONREG.exec(v.version)[1];
    });
}