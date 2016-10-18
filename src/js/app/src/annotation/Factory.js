/**
* 工厂模式
* @Author: robin
* @Date:   2016-09-14 17:29:59
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-09-14 19:35:18
*/

'use strict';
/*@AutoLoad*/
var Factory = module.exports = require('node-annotation').Annotation.extend({
    /**
     * compile the model
     * @param  {[Model]} model [annotation data]
     * @return
     */
    compile: function(model) {
        Factory.register(model.po(), model);
    }
}, {
    name: 'Factory',
    _items: {},
    /**
     * 注册
     * @param  {String} k key
     * @param  {Object} v value
     * @return {void}
     */
    register: function(k, v) {
        this._items[k] = v;
    },
    /**
     * 根据key获取值
     * @param  {String} k   key value
     * @param  {Object} ops instance option
     * @return {Object}
     */
    instance: function(k, ops){
        if(!this._items[k])return null;
        var classType = this._items[k].instance();
        return new classType(ops);
    }
});
