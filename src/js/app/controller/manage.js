'use strict'
var path = require('path'),
    fsExtra = require('fs-extra'),
    utils = require('../../common/utils');

require('shelljs/global');

var modulesCachePath = utils.getServerCachePath(),
    fileExt = utils.getFileExt();

/*@Controller*/
module.exports = {
    /*@RequestMapping(["/"])*/
    view: function(req, res){
        res.redirect('/view');
    }
}
