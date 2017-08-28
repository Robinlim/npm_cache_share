/**
 * 响应处理
 * User: xin.lin
 * Date: 17-8-22
 * control the response
 */
/*@AutoLoad*/
var na = require('node-annotation');

module.exports = na.Annotation.extend({
    /**
     * automatic transfer json to string
     * @return {[type]} [description]
     */
    execute: function() {
        var model = this.model,
            voParam = model.voParam(),
            resIndex;
        voParam.some(function(item, i) {
            if (item == 'res' || item == 'response') {
                resIndex = i;
                return true;
            }
        });

        model.exports().addMethodInterceptor(model.vo(), na.PROXYCYCLE.BEFORE, function() {
            if (typeof resIndex !== 'undefined') {
                var res = arguments[resIndex],
                    old = res.end;
                res.writeHead(200, {'Content-Type': 'application/json;charset=UTF-8'});
                res.end = function() {
                    if (typeof arguments[0] == 'object') {
                        arguments[0] = JSON.stringify(arguments[0]);
                    }
                    old.apply(res, arguments);
                };
            }
        });
    },
    /**
     * compile the model
     * @param  {[Model]} model [annotation data]
     * @return {[type]} [description]
     */
    compile: function(model) {
        model.exports();
    }
}, {
    //annotation name
    name: "ResponseBodyDeal"
});
