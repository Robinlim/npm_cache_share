/**
* @Author: wyw.wang <wyw>
* @Date:   2016-10-11 18:04
* @Email:  wyw.wang@qunar.com
* @Last modified by:   wyw
* @Last modified time: 2016-10-12 10:29
*/

var Swift = require('swift');

/*@Factory("swift")*/
function swift(config){
    var self = this;
    this.avaliable = false;
    this.storage = new Swift({
        user: 'test:tester',
        pass: 'testing',
        host: 'l-swift1.ops.dev.cn0.qunar.com',
        port: 80
    }, function(err, res){
        if(err){

        } else if(swift.account && swift.token){
            self.avaliable = true;
        }
    });
}

swift.prototype.check = function(){
    return this.avaliable;
};

swift.prototype.createRepository = function(repository, cbk){
    this.storage.createRepository(repository, cbk);
};

swift.prototype.listRepository = function(cbk){
    this.storage.listContainers(function(err, res){
        if(err) {
            cbk(err);
        } else if () {

        }
    });
};

swift.prototype.listPackages = function(repository, cbk){
    this.storage.listObjects(repository, function(err, res){

    });
};

swift.prototype.get = function(repository, name, cbk){

};

swift.prototype.put = function(repository, name, cbk){

};


module.exports = swift;
