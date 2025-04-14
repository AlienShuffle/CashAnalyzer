// This is a modern ES module with a set of common date utilities that I am trying to make general purpose
//
// https://www.digitalocean.com/community/tutorials/js-modules-es6

// Put the following import in the using project file to access all functions:
// import * as du from '../lib/dateUtils.mjs';
// reference as du.duDateLessThan();
// 
// Include only specifically used functions:
// import { safeObjectRef} from '../lib/utils.mjs';
// 
// Usage calls look like:
// const fooValue = if(!safeObjectRef(new Date) throw "error";
//

/**
 * Test if object exist and return otherwise return "";
 * @param {Object} obj object to test.
 * @return {Boolean} result
 */
export function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}