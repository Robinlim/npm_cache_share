/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-08 14:39
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-08 14:39
*/

'use strict'
var _ = require('lodash'),
    rpt = require('read-package-tree'),
    fsExtra = require('fs-extra');

var utils = require('./utils'),
    shellUtils = require('./shellUtils'),
    constant = require('./constant');

var config = fsExtra.readJsonSync(utils.getConfigPath());

module.exports = {
    npmPath: 'npm',
    /**
     * 配置npm路径
     * @param  {[String]} npmPath [npm path]
     * @return {[void]}
     */
    config: function(npmPath){
        this.npmPath = npmPath || 'npm';
    },
    getLastestVersion: function(moduleName, cbk) {
        shellUtils.exec(this.npmPath + ' view ' + moduleName + ' versions', function(code, stdout, stderr){
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
    npmShrinkwrap: function(cbk){
        shellUtils.exec(this.npmPath + ' shrinkwrap', function(code, stdout, stderr){
            if (code!== 0) {
                cbk(stderr);
            } else {
                cbk(null);
            }
        });
    },
    npmInstall: function(moduleName, opts, cbk){
        if(_.isFunction(opts)){
            cbk = opts;
            opts = moduleName;
            moduleName = null;
        }
        
        var optstr = utils.toString(opts, constant.NPMOPS),
            cmd = this.npmPath + ' install ' + ( moduleName ? moduleName + ' ' + optstr : optstr );
        console.debug(cmd);
        shellUtils.exec(cmd, function(code, stdout, stderr){
            if (code!== 0) {
                cbk(stderr);
            } else {
                cbk(null);
            }
        });
    },
    npmInstallWithoutSave: function(moduleNames, npmopts, opts){
        if(moduleNames.length === 0){
            return;
        }
        var optstr = utils.toString(npmopts, constant.NPMOPSWITHOUTSAVE),
            cmd = this.npmPath + ' install ' + moduleNames.join(' ') + ' ' + optstr,
            result = shellUtils.exec(cmd, opts);
        console.debug(cmd);
        if(result.code !== 0) {
            console.error(result.stderr);
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
