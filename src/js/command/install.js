/**
* @Author: robin
* @Date:   2016-08-08 17:30:24
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-22 13:20:43
*/

'use strict'
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');

var __cwd = process.cwd();
var NPMSHRINKWRAP = 'npm-shrinkwrap.json';
var npmShrinkwrapPath = path.resolve(__cwd, NPMSHRINKWRAP);

var installUtils = require('../common/installUtils');
/*@Flow*/
/*@Command("install")*/
module.exports = {

    run: function(opts) {
        console.info('******************开始安装******************');
        this.opts = opts;
        this.start();
    },
    /**
     * 由于主要依赖npm-shrinkwrap.json来处理依赖，故须检测该文件
     * @return {[boolean]}
     */
    /*@Step*/
    check: function(callback){
        var rs = fs.existsSync(npmShrinkwrapPath);
        if(!rs){
            var err = '缺少npm-shrinkwrap.json文件\n请在本地环境执行npm shrinkwrap指令来生成npm-shrinkwrap.json文件，上传至git库中!!';
            callback(err);
            return;
        }
        callback(null, true);
    },
    /**
     * 解析npm-shrinkwrap.json文件
     * @return {[type]} [description]
     */
    /*@Step("check")*/
    parse: function(rs, callback){
        try{
            console.info('读取npm-shrinkwrap.json文件！！');
            callback(null, fsExtra.readJsonSync(npmShrinkwrapPath).dependencies);
        }catch(e){
            console.error(e);
            callback(e);
        }
    },
    /**
     * 分析依赖
     * @return {[type]} [description]
     */
    /*@Step("parse")*/
    analyseDependency: function(rs, callback){
        if(!rs){
            callback('没有依赖！');
            return;
        }
        installUtils.parse(rs.parse, this.opts);
    },
    /*@Done*/
    done: function(err, results){
        if(err){
            console.error(err);
            this.exit();
            return;
        }
        this.exit();
    },
    /**
     * 退出
     * @return {[type]} [description]
     */
    exit: function(){
        console.info('******************安装结束******************');
        process.exit();
    }
}
