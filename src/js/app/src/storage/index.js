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
        storage = Factory.instance(storageType, opts.split('|'));
    }
    return storage;
};


module.exports = {
    init: function(type, opts){
        getStorage(type, opts);
    },
    createRepository: function(){
        var sto = getStorage();
        return sto.createRepository.apply(sto, arguments);
    },
    listPackageInfo: function(){
        var sto = getStorage();
        return sto.listPackageInfo.apply(sto, arguments);
    },
    get: function(){
        var sto = getStorage();
        return sto.get.apply(sto, arguments);
    },
    put: function() {
        var sto = getStorage();
        return sto.put.apply(sto, arguments);
    },
    listAll: cache.listAll,
    listRepository: cache.listRepository,
    listModules: cache.listModules,
    listPackages: cache.listPackages,
    diffPackages: cache.diffPackages
};
