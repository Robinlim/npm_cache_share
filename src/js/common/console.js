/**
* @Author: robin
* @Date:   2016-08-08 19:12:42
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-11 10:48:26
*/

var ansi = require('ansi-styles');

var joinArgs = function(args) {
  return Array.prototype.slice.call(args).join(' ');
};

console.info = function() {
  return console.log(ansi.green.open, '>[npm-cache-share]', new Date().toLocaleString(), joinArgs(arguments), ansi.green.close);
};

console.warn = function(){
  return console.log(ansi.yellow.open, '>[npm-cache-share]', new Date().toLocaleString(), joinArgs(arguments), ansi.yellow.close)
};

console.error = function() {
  return console.log(ansi.red.open, '>[npm-cache-share]', new Date().toLocaleString(), joinArgs(arguments), ansi.red.close);
};

console.debug = function() {
    if(global.DEBUG){
        return console.log.apply(console, arguments);
    } else {
        return null;
    }
}
