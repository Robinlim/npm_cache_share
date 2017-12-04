/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-08 14:39
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-08 14:39
*/

'use strict'
var _ = require('lodash'),
    semver = require('semver'),
    fsExtra = require('fs-extra'),
    rpt = require('read-package-tree');

var utils = require('./utils'),
    constant = require('./constant'),    
    shellUtils = require('./shellUtils');

var config = fsExtra.readJsonSync(utils.getConfigPath()),
    instInModulePath = {};

module.exports = {
    npmPath: 'npm',
    // 判断是否可以使用yarn
    checkYarn: (function(){
        var yarnCmd = shellUtils.which('yarn'),
            nodeVer = process.versions.node.split('-')[0];
        return yarnCmd && semver.satisfies(nodeVer, '>=4.0.0');
    })(),
    /**
     * 配置npm路径
     * @param  {[String]} npmPath [npm path]
     * @return {[void]}
     */
    config: function(npmPath){
        this.npmPath = npmPath || 'npm';
    },
    getLastestVersion: function(moduleName, cbk) {
        shellUtils.exec(this.npmPath + ' view ' + moduleName + ' versions --json', function(code, stdout, stderr){
            if(code !== 0){
                cbk(stderr);
            }else{
                try {
                    var versions = eval(_.trim(stdout));
                } catch (e) {
                    cbk(e);
                }
                if(Array.isArray(versions)){
                    cbk(null, versions[versions.length-1]);
                }else{
                    cbk('versions is not an array!');
                }
            }
        });
    },
    npmDedupe: function() {
        console.info('模块重组');
        //将层次结构重新组织
        shellUtils.exec(this.npmPath + ' dedupe', {
            async: false
        });
    },
    npmPrune: function() {
        console.info('清除多余模块');
        //删除多余的模块
        shellUtils.exec(this.npmPath + ' prune', {
            async: false
        });
    },
    npmShrinkwrap: function(cbk){
        shellUtils.exec(this.npmPath + ' shrinkwrap', function(code, stdout, stderr){
            if (code!== 0) {
                cbk('自动更新执行npm shrinkwrap失败：'+stderr+'如不需要版本锁定可忽略该错误。');
            } else {
                cbk(null);
            }
        });
    },
    npmInstall: function(npmopts, opts, cbk){
        //避免在模块路径下重复安装，和工程安装一样
        if(instInModulePath[opts.cwd]){
            cbk(null);
            return;
        }
        instInModulePath[opts.cwd] = 1;
        var optstr = utils.toString(npmopts, constant.NPMOPS),
            cmd = (this.checkYarn ? 'yarn' : this.npmPath) + ' install ' + optstr;
        console.debug(cmd, opts);
        shellUtils.exec(cmd, opts, function(code, stdout, stderr){
            if (code!== 0) {
                cbk(stderr);
            } else {
                cbk(null);
            }
        });
    },
    /**
     * 发布一个包到npm
     * @param  {url} registry
     * @param  {function} cbk    回调
     * @return {void}          [description]
     */
    npmPublish: function(registry, cbk){
        var optstr = registry ? (" --registry " + registry):"",
            cmd = "npm publish" + optstr;
        console.debug(cmd);
        shellUtils.exec(cmd, function(code, stdout, stderr){
            if(code!==0){
                cbk(stderr);
            }else{
                cbk(null);
            }
        });
    },
    /**
     * 由于yarn add会修改package.json，所以如果不修改的话需要指定成npm来安装
     */
    npmInstallModules: function(moduleNames, npmopts, opts, notSave){
        if(moduleNames.length === 0){
            return;
        }
        var optstr = utils.toString(npmopts, constant.NPMOPSWITHOUTSAVE),
            cmd;
        if(notSave){
            cmd = this.npmPath + ' install ' + moduleNames.join(' ') + ' ' + optstr;
        }else{
            var leading = this.checkYarn ? 'yarn add ' : this.npmPath + ' install ';
            cmd = leading + moduleNames.join(' ') + ' ' + optstr + (this.checkYarn && ' --non-interactive ' || '');
        }
        console.debug(cmd);
        var result = shellUtils.exec(cmd, opts);
        if(result.code !== 0) {
            throw result.stderr;
        }
    },
    /**
     * 过滤掉不恰当的依赖（平台不需要的optionalDependecise）
     * @param {String} action   模块pacakage.json中scripts属性所支持的 
     * @param {Object} opts     shelljs.exec支持的参数
     * @param {Function} cbk    回调函数
     */
    npmRunScript: function(action, opts, cbk){
        var cmd = (this.checkYarn ? 'yarn' : this.npmPath) + ' run ' + action;
        console.debug(cmd + ' ' + JSON.stringify(opts));
        //由于shelljs.exec中只要cbk存在则默认async会被设置成true，故需要区分
        if(opts.async){
            shellUtils.exec(cmd, opts, function(code, stdout, stderr){
                if (code!== 0) {
                    cbk(stderr);
                } else {
                    cbk(null);
                }
            });
        }else{
            var rs = shellUtils.exec(cmd, opts);
            if (rs.code!== 0) {
                cbk(rs.stderr);
            } else {
                cbk(null);
            }
        }
    },
    /**
     * 过滤掉不恰当的依赖（平台不需要的optionalDependecise）
     * @param  {JSON} dependencies [description]
     * @return {JSON}              [description]
     */
    filter: function(dependencies){
        var platform = process.platform,
            binds = config.npmPlatBinds || {},
            filterArr = [];
        _.forEach(binds, function(v, k){
            if(k !== platform){
                filterArr = filterArr.concat(v);
            }
        });
        console.debug('将被过滤的依赖：',filterArr);
        if(filterArr.length > -1){
            var news = _.cloneDeep(dependencies);
            filterEach(news, filterArr);
            return news;
        } else {
            return dependencies;
        }
    }
};

/**
 * 递归清除所有需过滤项
 * @param  {[type]} dependencies [description]
 * @param  {[type]} filter       [description]
 * @return {[type]}              [description]
 */
function filterEach(dependencies, filter){
    _.forEach(dependencies, function(v, k){
        if(filter.indexOf(k) > -1){
            console.debug('舍弃依赖:', k);
            delete dependencies[k];
            return;
        }
        if(v.dependencies){
            filterEach(v.dependencies, filter);
        }
    })
}

//  原来用以处理npm对于安装optionDependecies 出现平台不匹配的而误报错误中断安装的处理，现在使用白名单方式过滤
// function installTry(moduleNames, optstr, opts, skipDependencies){
//     if(moduleNames.length === 0){
//         return;
//     }
//     var cmd = 'npm install ' + moduleNames.join(' ') + ' ' + optstr,
//             result = exec(cmd, opts);
//         console.debug(cmd);
//         if(result.code !== 0) {
//             var err = result.stderr,
//                 errTarget = check(err),
//                 index = moduleNames.indexOf(errTarget);
//             if(errTarget && index > -1) {
//                     console.info(errTarget, 'is not suitable for current platform, skip it.');
//                     moduleNames.splice(index, 1);
//                     skipDependencies.push(errTarget);
//                     installTry(moduleNames, optstr, opts, skipDependencies);
//             } else {
//                 console.error(err);
//             }
//         }
// }
//
// function check(err){
//     var codeMatch = err.match(/npm ERR\! code (\w*)/);
//     if(codeMatch && codeMatch[1] === 'EBADPLATFORM'){
//         return err.match(/npm ERR\! notsup Not compatible with your operating system or architecture\: ([\w@\.]*)/)[1];
//     } else {
//         return false;
//     }
// }
