/**
 * @Author: robin
 * @Date:   2016-08-18 14:18:18
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-19 15:21:30
 */
var path = require('path'),
    _ = require('lodash'),
    fs = require('fs'),
    fsExtra = require('fs-extra'),
    osHomedir = require('os-homedir'),
    semver = require('semver');


var shellUtils = require('./shellUtils'),
    constant = require('./constant'),
    compressUtils = require('./compressUtils'),
    SPLIT = constant.SPLIT,
    arch = process.arch,
    platform = process.platform,
    v8 = /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0],
    //除支持x.x.x的版本之外，兼容以下格式的版本提取
    //http://xxx.xxx.com/unicode-5.2.0/-/unicode-5.2.0-0.7.5.tgz
    //http://xxx.xxx.com/async/-/async-2.0.0-rc.5.tgz
    //http://xxx.xxx.com/double-ended-queue/-/double-ended-queue-2.1.0-0.tgz
    // update: 0.0.1-beta.DZS-52350-20200416-objectUnion.42,  3.1.3-beta.PT-43399-trace.33,
    NPMVERSIONREG = /([0-9]+\.[0-9]+\..+(?:\.[^.]+)??)(\.tgz|$)/;
var utils = module.exports = {
    /**
     * 获取缓存的路径
     * @return {[type]} [description]
     */
    getCachePath: function() {
        var defaultCacheDirectory = process.env.NPM_CACHE_DIR;
        if (defaultCacheDirectory === undefined) {
            var homeDirectory = osHomedir();
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
     * @param  {String}   destpath 压缩文件里的路径
     * @param  {String}   type     解压模式 zip 或者 tar
     * @param  {Function} callback   回调
     * @return {stream}
     */
    compress: function(dir, destpath, type, callback) {
        return compressUtils.compressStream(dir, destpath, type, function () {
            console.debug(path.basename(dir) + ' compress done!');
            callback && callback(dir, type);
        });
    },
    /**
     * 解压处理，返回解压流，已确认解压路径，没有解压具体内容
     * @param  {String} source       需要解压的文件
     * @param  {String} target       解压到的目录
     * @param  {Function} callback   回调
     * @return {void}
     */
    extract: function(source, target, callback) {
        return compressUtils.extractStream(target, path.extname(source).substr(1), function(){
            console.debug(path.basename(source) + ' extract done!');
            callback && callback(source, target);
        });
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
            }
        });
        return dMap;
    },
    /**
     * 对比依赖和缓存，返回所需模块，忽略非识别的npm version的模块
     * 在npm5版本生成的固化版本里，有不带version描述的节点，如："istanbul-lib-hook": {"requires": {...}}，需要忽略此类对象
     * @param  {Array} dependencies 模块依赖
     * @param  {JSON}  cache        模块缓存
     * @param  {Function} callback  回调函数
     * @return {JSON}
     */
    compareCache: function(dependencies, cache, callback) {
        var news = [];
        _.forEach(dependencies, function(el){
            if(!el.version){
                return;
            }
            if (!utils.hasNpmVersion(el.version)
                || (!cache[utils.getModuleName(el.name, el.version)]
                    && !cache[utils.getModuleNameForPlatform(el.name, el.version)])) {
                news.push(el);
                callback && callback(el);
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
     * @param  {String} modulePath   模块路径
     * @return {String}
     */
    getModuleName: function(name, version, dependencies, modulePath) {
        if (this.isGypModule(dependencies, modulePath)) {
            return this.getModuleNameForPlatform(name, version);
        }
        return [name, version].join('@').replace(RegExp('/', 'g'), SPLIT);
    },
    /**
     * 判断是否需要node-gyp编译的模块
     * @param  {Object} dependencies 模块依赖
     * @param  {String} modulePath   模块路径
     * @return {Boolean}
     */
    isGypModule: function(dependencies, modulePath){
        //for <= node v0.8 use node-waf to build native programe with wscript file
        //for > node v0.8 use node-gyp to build with binding.gyp
        //see also: https://www.npmjs.com/package/node-gyp
        if ((dependencies && dependencies['node-gyp']) ||
        (modulePath && (shellUtils.test('-f', path.resolve(modulePath, 'binding.gyp')) || shellUtils.test('-f', path.resolve(modulePath, 'wscript'))))) {
            return true;
        }
        return false;
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
        // @qnpm/Qredis@0.0.1 => @qnpm/Qredis
        var arr = name.split('@'), moduleName;
        if(arr[0] === ''){
            var index = (arr.length > 3) ? 5 : 2;
            moduleName = arr.slice(0, index).join('@');
        } else {
            moduleName = arr[0];
        }
        return moduleName;
    },
    /**
     * 切分出模块的版本信息
     * @param  {string} name [description]
     * @return {string}      [description]
     */
    splitModuleVersion: function(name){
        var arr = name.split('@');
        if(arr[0] === ''){
            return (arr.length > 3) ? arr[5]:arr[2];
        } else {
            return arr[1];
        }
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
    },
    /**
     * 取出一个包名称列表中版本最新的
     * @param  {array} versions 包名称数组
     * @return {object}         最新版的包版本
     */
    getLastestVersion: function(versions){
        var latest,
            splitModuleVersion = this.splitModuleVersion;
        _.forEach(versions, function(el){
            var version = splitModuleVersion(el);
            if(!latest || semver.gt(version, latest)){
                latest = version;
            }
        });
        return latest;
    },
    /**
     * 生成swift资源地址
     * @param  {[String]} host      域名
     * @param  {[String]} user      账户
     * @param  {[String]} container 容器
     * @param  {[String]} obj       对象
     * @return {[String]}
     */
    generateSwiftUrl: function(host, user, container, obj, ceph){
        if(ceph == 'true' || ceph === true){
            return "http://" + [host, container, obj].join('/');
        }
        return "http://" + [host, user.split(':')[0], container, obj].join('/');
    },
    /**
     * 判断是否是SNAPSHOT版本
     * @param  {[String]} name 模块名称带版本
     * @return {[Boolean]}
     */
    isSnapshot: function(name) {
        return RegExp(constant.VERSION_TYPE.SNAPSHOT, 'i').test(name);
    },
    /**
     * 判断是否是可识别的npm version
     * @param  {[String]} name 模块名称带版本
     * @return {[Boolean]}
     */
    hasNpmVersion: function(name){
        return NPMVERSIONREG.exec(name);
    },
    /**
     * 判断是否是模块名称带版本
     * @param  {[String]} name
     * @return {[Boolean]}
     */
    isModuleVersion: function(){
        var mv = /[^@]+@\d+\.\d+\.\d+/;
        return function(name){
            return mv.test(name);
        };
    }(),
    /**
     * 获取release和snapshot库名称，请求的路径中repository的值为 releaseRepository-snapshotRepository
     * @param {[String]} repo
     */
    getRepos: function(repo){
        var repos = repo.split('-'),
            release = repos[0],
            snapshot = repos[1] || repos[0];
        return function(name){
            if(typeof name == 'boolean'){
                return name ? snapshot : release;
            }
            return utils.isSnapshot(name) ? snapshot : release;
        }
    },
    getRepoNames: function(repo){
        var repos = repo.split('-');
        return {
            release: repos[0],
            snapshot: repos[1] || repos[0]
        };
    }
};
