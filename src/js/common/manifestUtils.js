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
    utils = require('./utils');

var NPMSHRINKWRAP = 'npm-shrinkwrap.json',
    YARNLOCKFILE = 'yarn.lock',
    NPMVERSIONREG = /([0-9]+\.[0-9]+\.[\s\S]+)\.tgz/,
    VERSIONSTART = /^[0-9]+/;

module.exports = {
    readManifest: function(base, name, cbk){
        var npmShrinkwrapPath = path.resolve(base, NPMSHRINKWRAP),
            yarnLockfilePath = path.resolve(base, YARNLOCKFILE);
        // 未指定依赖时尝试用npm-shrinkwrap.json或yarn.lock
        if(!name){
            if(fs.existsSync(npmShrinkwrapPath)){
                parseNpmShrinkwrap(npmShrinkwrapPath, base, NPMSHRINKWRAP, cbk);
            } else if(fs.existsSync(yarnLockfilePath)){
                parseYarnLockfile(yarnLockfilePath, cbk);
            } else {
                console.warn('缺少npm-shrinkwrap.json并未指定其lockfile，此次安装将直接使用npm install');
                cbk();
            }
        } else {
            var manifestPath = path.resolve(base, name);
            if(!fs.existsSync(manifestPath)){
                cbk('Cannot find path '+manifestPath+',check your --lockfile option!');
            }
            if(name === YARNLOCKFILE){
                parseYarnLockfile(manifestPath, cbk);
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


function parseYarnLockfile(filepath, cbk){
    console.info('将读取'+YARNLOCKFILE+'获取依赖');
    var dependenceArr = [],
        one = null;
    var NAMEREG = /\"*(@*[^\@]*)\@/,
        VERSIONREG = /\s*version "([^"]*)"/,
        DEPENDREG = /\s*dependencies:/,
        KVREG = /\s*(\S*)\s*"([^"]*)"/;
    var rl = readline.createInterface({
            input: fs.createReadStream(filepath)
        });
    rl.on('line', function(line){
        if(!one){
            // 非注释非缩进且包含：的行 为依赖名称行
            if(line[0] !== '#' && line[0] !== ' ' && line[line.length-1] === ':'){
                var match = line.match(NAMEREG),
                    name = match[1],
                    ranges = _.map(line.slice(0, -1).split(','), function(s){
                        // 去除首尾的空格和双引号
                        return _.trim(_.trim(s), '"');
                    });
                one = {
                    name: name,
                    ranges: ranges
                }
            } else {
                return;
            }
        } else {
            // 存在一个依赖块的时候
            if(!one.version){
                var match = line.match(VERSIONREG);
                if(match){
                    one.version = match[1];
                } else {
                    cbk(new Error('unexpected token in :' + line));
                }
                tempname = '';
                return;
            } else {
                // 一个依赖块可能没有子依赖直接结束
                if(line === ''){
                    // 空行代表一个依赖块的结束
                    dependenceArr.push(_.extend({},one));
                    one = null;
                    return;
                }
                // 存在子依赖块时
                if(!one.dependencies){
                    var match = line.match(DEPENDREG);
                    if(match){
                        one.dependencies = {};
                        return;
                    }
                } else {
                    // 子依赖块也是以空行结束，并且是整个依赖块的结束
                    if(line !== ''){
                        // 不处理各类不同的dependencies，统一作为dependencies
                        var match = line.match(KVREG);
                        if(match){
                            one.dependencies[match[1]] = {
                                "name": match[1],
                                "from": match[1] + '@' + match[2]
                            };
                        }
                    } else {
                        // 空行代表一个依赖块的结束
                        dependenceArr.push(_.extend({},one));
                        one = null;
                    }
                }
            }
        }
    });
    rl.on('close', function(){
        //文件结束后one应该未空，未为空的场景下需要添加到dependenceArr
        if(one){
            dependenceArr.push(_.extend({},one));
            one = null;
        }
        var nameMap = {}, // 按模块名称构造的map
            rangeMap = {}, // 按模块名称包含版本范围构造的map
            dependList = {}, // 打平成list的依赖，key值是“name@version”
            dependencies = {}; // 最终生成的树状结构的依赖
        // 第一次遍历，取出按照{moduleName:{single:"version",multi:[versions]}}构造的nameMap
        // 以及按照形如{"[moduleName]@>1.0.0 <2.1.0":"[moduleName]@2.0.0"}构造的rangeMap
        _.forEach(dependenceArr, function(el){
            if(!nameMap[el.name]){
                nameMap[el.name] = {
                    single: el.version
                };
            } else {
                var target = nameMap[el.name];
                if(!target.multi){
                    var multi = {};
                    multi[target.single] = 0;
                    multi[el.version] = 0;
                    target.multi = multi;
                } else {
                    target.multi[el.version] = 0;
                }
            }
            dependList[el.name + '@' + el.version] = {
                version: el.version
            }
            _.forEach(el.ranges, function(range){
                rangeMap[range] = el.version;
            });
        });
        // 第二次遍历，将dependenceArr里面的dependencies的每项的from按照rangeMap映射成特定version
        // 同时将nameMap中出现次数最多的version提为single（这个版本将在安装时出现在顶层）
        _.forEach(dependenceArr, function(el){
            if(el.dependencies){
                _.forEach(el.dependencies, function(v, k){
                    v['version'] = rangeMap[v.from];
                    var target = nameMap[v.name];
                    if(target.multi){
                        target.multi[v.version]++;
                        if(target.multi[v.version] > target.multi[target.single]){
                            target.single = v.version;
                        }
                    }
                });
            }
        });
        // 第三次遍历，将dependenceArr中有用的部分生成用线性表dependList存储的树，同时用dependecies生成对应结构
        // 多版本时出现次数最多的依赖将被放置在顶层，其余依赖仍保持原位
        _.forEach(dependenceArr, function(el){
            var name = el.name,
                version = el.version;
            if(!nameMap[name].multi || version === nameMap[name].single){
                var full = name + '@' + version;
                dependencies[name] = dependList[full];
                if(el.dependencies){
                    var children = {};
                    _.forEach(el.dependencies, function(em){
                        if(nameMap[em.name].multi && nameMap[em.name].single !== em.version){
                            children[em.name] = dependList[em.name + '@' + em.version];
                        }
                    });
                    if(_.keys(children).length > 0){
                        dependencies[name]['dependencies'] = children;
                    }
                }
            }
        });

        console.debug('各个依赖按版本的出现次数：',nameMap);
        //console.debug(JSON.stringify(dependencies));
        cbk(null, _.cloneDeep(dependencies));
    })
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
        if(VERSIONSTART.test(v.version)){
            return;
        }
        v.version = NPMVERSIONREG.exec(v.version)[1];
    });
}