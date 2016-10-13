/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-12 10:37
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:37
*/


var Factory = require('../annotation/Factory');

var storage = null,
    cache = {};

function getStorage(storageType, opts){
    if(!storage){
        storage = Factory.instance(storageType, opts);
    }
    return storage;
};

/**
 * cache action
 */



module.exports = {
    init: function(){
        storage.listRepository(function(err, repositorys){
            _.forEach(repositorys, function(el){
                cache[repository] = {
                    name: repository,
                    stat:
                    modules: {}
                }
            });
        });
    }
};
