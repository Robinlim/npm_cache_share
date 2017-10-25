/**
 * @Author: robin
 * @Date:   2016-08-22 17:30:24
 * @Email:  xin.lin@qunar.com
* @Last modified by:   robin
* @Last modified time: 2016-08-22 19:09:20
 */

'use strict'

/*@Command("help")*/
module.exports = {
    run: function(ops, nomnom) {
        nomnom
            .printer()
            .parse(["-h"]);
    }
}
