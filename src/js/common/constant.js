/**
 * @Author: robin
 * @Date:   2016-09-18 10:58:34
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-18 11:06:16
 */

module.exports = {
    LIBNAME: 'node_modules',
    UPLOADDIR: 'upload_dir',
    MODULECHECKER: 'modules_check_dir',
    SPLIT: '@@@',
    NPMOPS: {
        noOptional: 'no-optional',
        saveDev: 'save-dev',
        save: 'save',
        production: 'production',
        registry: 'registry',
        disturl: 'disturl'
    },
    NPMOPSWITHOUTSAVE: {
        noOptional: 'no-optional',
        production: 'production',
        registry: 'registry',
        disturl: 'disturl'
    },
    PM2OPS: {
        i: 1,
        name: 1
    },
    NPM_MAX_BUNDLE: 50,
    LOAD_MAX_RESOUCE: 100,
    CONFIGKEY: [
        'registry',
        'token',
        'type',
        'repository',
        'disturl',
        'port',
        'i',
        'name',
        'storage',
        'storageConfig',
        'storageSnapshotConfig',
        'installTimeout',
        'npmPlatBinds',
        'swift',
        'resourceSwift',
        'resourceSnapshotSwift',
        'compressType',
        'nameReg',
        'zookeeper'
    ],
    F2B: {
        CONFIG_FILE: 'package.json',
        SPLIT: '@@@',
        CONFIG_KEY: 'f2b'
    },
    COMPRESS_TYPE: {
        TAR: 'tar',
        ZIP: 'zip'
    },
    VERSION_TYPE:{
        SNAPSHOT: 'SNAPSHOT',
        RELEASE: 'RELEASE'
    },
    CACHESTRATEGY: {
        //强制更新，始终从中央缓存获取的，含有SNAPSHOT标示的默认为该策略
        ALWAYSUPDATE: 'alwaysUpdate',
        //强制安装，忽略本地缓存和中央缓存
        IGNORECACHE: 'ignoreCache',
        //模块包安装后运行指定脚本
        POSTINSTALL: 'postInstall'
    }
}
