/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-12 10:37
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/


var Factory = require('../annotation/Factory'),
    cache = require('../cache');

var storage = null;

function getStorage(storageType, opts, snapshotOpts){
    if(!storage){
        storage = Factory.instance(storageType, opts, snapshotOpts);
    }
    return storage;
};


module.exports = {
    init: function(type, opts, snapshotOpts){
        opts == snapshotOpts && cache.same();
        // opts can be a STRING ! ‘undefined’
        cache.setStorage(getStorage(type, opts === 'undefined' ? [] : (opts || "").split('|'), snapshotOpts === 'undefined' ? [] : (snapshotOpts || "").split('|')));
    },
    sync: function(){
        var sto = getStorage();
        return sto.sync.apply(sto, arguments);
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
    listAll: cache.listAll.bind(cache),
    listRepository: cache.listRepository.bind(cache),
    listModules: cache.listModules.bind(cache),
    listPackages: cache.listPackages.bind(cache),
    diffPackages: cache.diffPackages.bind(cache)
};
