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
 * Parse a string containing a \n line CSV file contents, return in a 2D array.
 * @param {string} str csv file contents to parse.
 * @return {char} delimeter default=',', value separator.
 */
export function csvToMatrix(str, delimiter = ",") {
    // use split to create an array of each csv value row
    const rows = str.slice().split("\n");

    // Map the rows, split values from each row into an array
    const matrix = rows.map(function (row) {
        return row.split(delimiter);
    });
    return matrix;
}

/**
 * Test if object exist and return otherwise return "";
 * @param {Object} obj object to test.
 * @return {Boolean} result
 */
export function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

/**
 * return the number rounded to a fixed number of decimal places.
 * @param {number} value number to round.
 * @param {number} decimals number of decimal places to round to.
 * @return {string} result
 */
export function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * return the number as a string rounded to a fixed number of decimal places.
 * @param {number} value number to round.
 * @param {number} decimals number of decimal places to round to.
 * @param {number} trunc (optional) number of decimal places to truncate to.
 * @return {string} result
 */
export function roundToFixed(value, decimals, trunc = -1) {
    const factor = Math.pow(10, decimals);
    const rounded = (Math.round((value + Number.EPSILON) * factor) / factor);
    // If no truncation requested, return rounded to the specified decimals
    if (trunc === -1) return rounded.toFixed(decimals);
    return rounded.toFixed(trunc);
}
//console.log(roundToFixed(1.1234567, 5));
//console.log(roundToFixed(1.1234567, 6));
//console.log(roundToFixed(1.1234567, 5, 4));
//console.log(roundToFixed(1.1234567, 5, 6)); // this is the BLS standard for rounding almost everything!
