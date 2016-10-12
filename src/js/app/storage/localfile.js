/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-11 18:04
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:29
*/

var fs = require('fs'),
    fsExtra = require('fs-extra');

/*@Factory("localfile")*/
function localfile(config){
    this.dir = config.dir;
}

localfile.prototype.check = function(){
    return this.avaliable;
};

localfile.prototype.createRepository = function(repository, cbk){

};

localfile.prototype.listRepository = function(cbk){
    this.storage.listContainers(function(err, cbk){

    });
};

localfile.prototype.listPackages = function(repository, cbk){
    this.storage.listObjects(repository, function(err, res){

    });
};

localfile.prototype.get = function(repository, name, cbk){

};

localfile.prototype.put = function(repository, name, cbk){

};

module.exports = localfile;
