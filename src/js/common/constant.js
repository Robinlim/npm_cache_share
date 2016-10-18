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
        'installTimeout'
    ]
}
