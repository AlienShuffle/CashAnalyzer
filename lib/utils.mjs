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

// internally used function for Rounding.
const nudge = v => v === 0 ? v : v + Math.sign(v) * Math.max(1e-9, Math.abs(v) * 1e-12);

/**
 * return the number rounded to a fixed number of decimal places.
 * @param {number} x number to round.
 * @param {number} roundDp number of decimal places to round to.
 * @return {string} result
 */
export function roundTo(x, roundDp = 5) {
    const roundFactor = Math.pow(10, roundDp);
    return Math.round(nudge(x * roundFactor)) / roundFactor;
}

/**
 * Return the parameter value as a number rounded to a fixed number of decimal places
 * and potentially truncated to a different number of places before rounding.
 * @param {number} x number to round.
 * @param {number} roundDp number of decimal places to round to.
 * @param {number} truncDp (optional) number of decimal places to truncate to.
 * @return {string} result
 */
export function roundToFixed(x, roundDp = 5, truncDp = -1) {
    if (x === null) return x;

    const truncFactor = 10 ** truncDp;
    const truncated = (truncDp === -1) ? x : (Math.trunc(nudge(x * truncFactor)) / truncFactor);
    const roundFactor = 10 ** roundDp;
    return Math.round(nudge(truncated * roundFactor)) / roundFactor;

    /* this was my original approach, but it was not always accurate for very small numbers, so I switched to the above approach.
    //This was likely just a good, but wasn't sure.
    const truncValue = (truncDp === -1) ? x : x.toFixed(truncDp) * 1;
    const factor = Math.pow(10, roundDp);
    const rounded = (Math.round((truncValue + Number.EPSILON) * factor) / factor);
    return rounded.toFixed(roundDp) * 1;
    */
}
//console.log(roundToFixed(1.1234567, 5));
//console.log(roundToFixed(1.1234567, 6));
//console.log(roundToFixed(1.1234567, 5, 4));
//console.log(roundToFixed(1.1234567, 5, 6)); // this is the BLS standard for rounding almost everything!
