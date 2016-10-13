/**
* @Author: robin
* @Date:   2016-08-08 19:12:42
* @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-11 10:48:26
*/

var joinArgs = function(args) {
  return Array.prototype.slice.call(args).join(' ');
};

console.info = function() {
  return console.log('\x1B[32m>[npm-cache-share]', joinArgs(arguments), '\x1B[39m');
};

console.error = function() {
  return console.log('\x1B[31m>[npm-cache-share]', joinArgs(arguments), '\x1B[39m');
};

console.debug = function() {
    if(global.DEBUG){
        return console.log.apply(console, arguments);
    } else {
        return null;
    }
}
