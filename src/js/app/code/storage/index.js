/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-12 10:37
* @Email:  wyw.wang@qunar.com
* @Last modified by:   robin
* @Last modified time: 2017-05-08 10:37
*/

var Factory = require('../annotation/Factory'),
    cache = require('../cache'),
    _ = require('lodash');

var storage = null;

function getStorage(storageType, opts, snapshotOpts, swiftTokenTimeout){
    if(!storage){
        storageClass = storageType == 'localfile' ? require('./localfile') : require('./swift');
        storage = new storageClass(opts, snapshotOpts, swiftTokenTimeout);
    }
    return storage;
};


module.exports = {
    init: function(type, opts, snapshotOpts, swiftTokenTimeout){
        opts == snapshotOpts && cache.same();
        // opts can be a STRING ! ‘undefined’
        cache.setStorage(getStorage(type, 
            opts === 'undefined' ? [] : (opts || "").split('|'), 
            snapshotOpts === 'undefined' ? [] : (snapshotOpts || "").split('|'), swiftTokenTimeout));
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
    listAll: _.bind(cache.listAll, cache),
    listRepository: _.bind(cache.listRepository, cache),
    listModules: _.bind(cache.listModules, cache),
    listPackages: _.bind(cache.listPackages, cache),
    diffPackages: _.bind(cache.diffPackages, cache)
};
