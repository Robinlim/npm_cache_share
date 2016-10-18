/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-08 14:39
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-08 14:39
*/

'use strict'
var _ = require('lodash'),
    rpt = require('read-package-tree');

require('shelljs/global');

var utils = require('./utils'),
    constant = require('./constant');

module.exports = {
    getLastestVersion: function(moduleName, cbk) {
        exec('npm view ' + moduleName + ' versions', function(code, stdout, stderr){
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
        exec('npm shrinkwrap', function(code, stdout, stderr){
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
            cmd = 'npm install ' + ( moduleName ? moduleName + ' ' + optstr : optstr );
        exec(cmd, function(code, stdout, stderr){
            if (code!== 0) {
                cbk(stderr);
            } else {
                cbk(null);
            }
        });
    },
    npmInstallWithoutSave: function(moduleNames, npmopts, opts, skipDependencies){
        var optstr = utils.toString(opts, constant.NPMOPSWITHOUTSAVE);
        installTry(moduleNames, optstr, opts, skipDependencies);
    }
};

function installTry(moduleNames, optstr, opts, skipDependencies){
    if(moduleNames.length === 0){
        return;
    }
    var cmd = 'npm install ' + moduleNames.join(' ') + ' ' + optstr,
            result = exec(cmd, opts);
        console.debug(cmd);
        if(result.code !== 0) {
            var err = result.stderr,
                errTarget = check(err),
                index = moduleNames.indexOf(errTarget);
            if(errTarget && index > -1) {
                    console.info(errTarget, 'is not suitable for current platform, skip it.');
                    moduleNames.splice(index, 1);
                    skipDependencies.push(errTarget);
                    installTry(moduleNames, optstr, opts, skipDependencies);
            } else {
                console.error(err);
            }
        }
}

function check(err){
    var codeMatch = err.match(/npm ERR\! code (\w*)/);
    if(codeMatch && codeMatch[1] === 'EBADPLATFORM'){
        return err.match(/npm ERR\! notsup Not compatible with your operating system or architecture\: ([\w@\.]*)/)[1];
    } else {
        return false;
    }
}
