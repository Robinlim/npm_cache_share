/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-12 10:37
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:37
*/


var Factory = require('../annotation/Factory'),
    cache = require('./cache');

var storage = null;

function getStorage(storageType, opts){
    if(!storage){
        storage = Factory.instance(storageType, opts);
    }
    return storage;
};


module.exports = {
    init: function(type, opts){
        console.log(type, opts)
        getStorage(type, opts).init();
    },
    listPackageInfo: function(){
        var sto = getStorage();
        return sto.listPackageInfo.apply(sto, arguments);
    },
    listAll: cache.listAll,
    listRepository: cache.listRepository,
    listModules: cache.listModules,
    listPackages: cache.listPackages,
    diffPackages: cache.diffPackages
};
