/**
 * @Author: robin
 * @Date:   2016-08-18 14:18:18
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:21:30
 */
var path = require('path'),
    _ = require('lodash'),
    tar = require('tar'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    fstream = require('fstream');


var shellUtils = require('./shellUtils'),
    constant = require('./constant'),
    SPLIT = constant.SPLIT,
    arch = process.arch,
    platform = process.platform,
    v8 = /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];

var utils = module.exports = {
    /**
     * 获取缓存的路径
     * @return {[type]} [description]
     */
    getCachePath: function() {
        var defaultCacheDirectory = process.env.NPM_CACHE_DIR;
        if (defaultCacheDirectory === undefined) {
            var homeDirectory = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
            if (homeDirectory !== undefined) {
                defaultCacheDirectory = path.resolve(homeDirectory, '.npm_cache_share');
            } else {
                defaultCacheDirectory = path.resolve('/tmp', '.npm_cache_share');
            }
        }
        fsExtra.ensureDirSync(defaultCacheDirectory);
        return defaultCacheDirectory;
    },
    /**
     * 获取存储配置的路径
     * @return {path} path for config
     */
    getConfigPath: function() {
        var file = path.resolve(this.getCachePath(), '../.npm_cache_share_config.json');
        if(!fs.existsSync(file)){
            fsExtra.writeJsonSync(file, {});
        }
        return file;
    },
    /**
     * 获得文件后缀
     * @return {[type]} [description]
     */
    getFileExt: function() {
        return '.tar';
    },
    /**
     * 获取服务器端缓存cache的目录
     * @return {path} [description]
     */
    getServerCachePath: function() {
        var dir = path.resolve(process.cwd(), 'npm_cache_share');
        fsExtra.ensureDirSync(dir);
        return dir;
    },
    /**
     * 将参数序列化
     * @param  {Object} opts       options object
     * @param  {Object}map         white list
     * @return {String}            生成 --option 这样的字符串拼接
     */
    toString: function(opts, map) {
        var ops = [];
        _.each(opts || {}, function(v, k) {
            if (map[k]) {
                ops.push('--' + map[k]);
                if (typeof v != 'boolean') {
                    ops.push(v);
                }
            }
        });
        return ops.join(' ');
    },
    /**
     * 压缩处理
     * @param  {String}   dir      需要压缩的文件夹路径
     * @return {stream}
     */
    compress: function(dir) {
        //错误处理
        function onError(err) {
            console.error(err);
        }

        //压缩结束
        function onEnd() {
            console.info('compress done!');
        }

        var packer = tar.Pack({
                noProprietary: true
            })
            .on('error', onError)
            .on('end', onEnd);

        // This must be a "directory"
        return fstream.Reader({
                path: dir,
                type: "Directory"
            })
            .pipe(packer);
    },
    /**
     * 解压处理
     * @param  {String} target       需要解压的文件
     * @param  {String} dir          解压到的目录
     * @param  {Function} callback   回调
     * @return {void}
     */
    extract: function(target, dir, callback) {
        //错误处理
        function onError(err) {
            callback(err);
        }
        //处理结束
        function onEnd() {
            callback();
        }

        var extractor = tar.Extract({
                path: dir
            })
            .on('error', onError)
            .on('end', onEnd);

        fs.createReadStream(target)
            .on('error', onError)
            .pipe(extractor);
    },
    /**
     * 确保一个文件夹存在并且可写入
     * @param  {Path} dir 文件夹路径
     * @return {void}
     */
    ensureDirWriteablSync: function(dir) {
        try {
            fsExtra.ensureDirSync(dir);
            fs.accessSync(dir, fs.W_OK);
        } catch (e) {
            console.error('Cannnot write into ' + dir + ', Please try running this command again as root/Administrator.');
            throw e;
        }
    },
    /**
     * 获取指定路径下的文件一级目录
     * @param {String} p    指定路径
     * @return {JSON}       文件一级目录
     */
    lsDirectory: function(p) {
        var dMap = {};
        shellUtils.ls(p).forEach(function(file) {
            if (file == constant.LIBNAME) return;
            if (shellUtils.test('-f', path.resolve(p, constant.MODULECHECKER, file))) {
                dMap[file] = 1;
            } else {
                dMap[file] = 0;
            }
        });
        return dMap;
    },
    /**
     * 对比依赖和缓存，返回所需模块
     * @param  {Array} dependencies 模块依赖
     * @param  {JSON} cache        模块缓存
     * @return {JSON}
     */
    compareCache: function(dependencies, cache) {
        var news = [];
        _.forEach(dependencies, function(el){
            if (!cache[utils.getModuleName(el.name, el.version)]
            && !cache[utils.getModuleNameForPlatform(el.name, el.version)]) {
                news.push(el);
            }
        });
        return news;
    },
    /**
     * 递归遍历依赖树
     * @param  {JSON}   tree            依赖树
     * @param  {Function} callback      回调
     * @param  {String} modulePath      模块层次
     * @return {void}
     */
    traverseDependencies: function(tree, callback, modulePath) {
        _.each(tree, function(v, k) {
            callback(v, k, modulePath);
            v.dependencies && utils.traverseDependencies(v.dependencies, callback, modulePath ? path.resolve(modulePath, constant.LIBNAME, k) : k);
        });
    },
    /**
     * 获取平台相关参数
     * @return {String}
     */
    getPlatform: function(){
        return platform + '-' + arch + '-v8-' + v8;
    },
    /**
     * 生成和环境相关的名称
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @param  {String} platform     指定平台
     * @return {String}
     */
    getModuleNameForPlatform: function(name, version, platform) {
        return [name, version, platform || this.getPlatform()].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 生成带版本的模块名
     * @param  {String} name         模块名称
     * @param  {String} version      模块版本
     * @param  {Object} dependencies 模块依赖
     * @return {String}
     */
    getModuleName: function(name, version, dependencies, modulePath) {
        //for <= node v0.8 use node-waf to build native programe with wscript file
        //for > node v0.8 use node-gyp to build with binding.gyp
        //see also: https://www.npmjs.com/package/node-gyp
        if ((dependencies && dependencies['node-gyp']) ||
            (modulePath && (shellUtils.test('-f', path.resolve(modulePath, 'binding.gyp')) || shellUtils.test('-f', path.resolve(modulePath, 'wscript'))))) {
            return this.getModuleNameForPlatform(name, version);
        }
        return [name, version].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 从包含环境与版本的包名称中切分出模块名称
     * @param  {string} name 包名称
     * @return {string}      模块名称
     */
    splitModuleName: function(name){
        // 处理形如下方的包名称
        // name => moduleName
        // five@0.0.1 ＝> five
        // five@0.0.1.tar => five
        // fibers@0.1.0@x64-Linux-v8 => fibers
        // @qnpm@@@Qredis@0.0.1 => @qnpm@@@Qredis
        var arr = name.split('@'), moduleName;
        if(arr[0] === ''){
            moduleName = arr.slice(0,-1).join('@');
        } else {
            moduleName = arr[0];
        }
        return moduleName;
    },
    /**
     * 生成包含环境信息的包名称
     * @param  {string} moduleName 形如five@0.0.1
     * @param  {string} env        形如x64-Linux-v8
     * @return {string}            [description]
     */
    joinPackageName: function(moduleName, env){
        return moduleName + '@' + env;
    },
    /**
     * 遍历树
     * @param  {JSON}   tree        树形结构
     * @param  {Function} callback  回调函数
     * @return {void}
     */
    traverseTree: function(tree, callback) {
        _.each(tree, function(v, i) {
            v.children && v.children.length > 0 && utils.traverseTree(v.children, callback);
            callback(v, i, tree.length);
        });
    },
    /**
     * 遍历dependencies生成数组(按照name和version去重)
     * @param  {JSON} dependencies 树形依赖
     * @return {Array}              生成的打平的依赖数组
     */
    dependenciesTreeToArray: function(dependencies){
        var arr = [],
            map = {};
        this.traverseDependencies(dependencies, function(v, k){
            var full = k.replace(RegExp('/', 'g'), SPLIT) + '@' + v.version;
            if(!map[full]){
                map[full] = 1;
                arr.push({
                    name: k,
                    version: v.version,
                    full: full
                });
            }
        });
        return arr;
    },
    /**
     * map转换成array，只有一级
     * @param  {JSON} jsonObj
     * @return {Array}
     */
    toArrayByKey: function(jsonObj) {
        var arrs = [];
        _.each(jsonObj, function(v, k){
            arrs.push(k);
        });
        return arrs;
    }
};
