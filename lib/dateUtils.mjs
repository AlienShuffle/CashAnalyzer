// This is a modern ES module with a set of common date utilities that I am trying to make general purpose
//
// https://www.digitalocean.com/community/tutorials/js-modules-es6

// Put the following import in the using project file to access all functions:
// import * as du from '../lib/dateUtils.mjs';
// reference as du.duDateLessThan();
// 
// Include only specifically used functions:
// import { duDateLessThan, duGetISOString} from '../lib/dateUtils.mjs';
// 
// Usage calls look like:
// const fooValue = duGetISOString(new Date);
//

/**
 * Calculated if startDate is earlier than endDate only using actual dates/days, ignores minutes/seconds in the date in local time.
 * @param {Date} startDate first date
 * @param {Date} endDate second date
 * @return {Boolean} result
 */
export function duDateLessThan(startDate, endDate) {
    const sYear = startDate.getFullYear();
    const eYear = endDate.getFullYear();
    if (sYear < eYear) return true;
    if (sYear > eYear) return false;
    const sMonth = startDate.getMonth();
    const eMonth = endDate.getMonth();
    if (sMonth < eMonth) return true;
    if (sMonth > eMonth) return false;
    const sDate = startDate.getDate();
    const eDate = endDate.getDate();
    if (sDate < eDate) return true;
    return false;
}

/**
 * Calculated if startDate is same as endDate only using actual calendar dates, ignores minutes/seconds in the date in local time.
 * @param {Date} startDate first date
 * @param {Date} endDate second date
 * @return {Boolean} result
 */
export function duDateEqualTo(startDate, endDate) {
    if (startDate.getFullYear() != endDate.getFullYear()) return false;
    if (startDate.getMonth() != endDate.getMonth()) return false;
    if (startDate.getDate() != endDate.getDate()) return false;
    return true;
}

/**
 * Converts an epoch seconds date number (post-1/1/1970) into a javascript Date object.
 * @param {number} secs seconds since the epoch
 * @return {Date} dateTime
 */
export function duDateTimeFromSecs(secs) {
    const t = new Date(1970, 0, 1); // Epoch
    t.setSeconds(secs);
    return t;
}

/**
 * Calculates number of 24 hour periods between startDate and endDate, using full time in Date object, attempts to adjust for DST changes.
 * @param {Date} startDateTime first date
 * @param {Date} endDateTime second date
 * @return {float} days.partialdays
 */
export function duDaysBetween(startDateTime, endDateTime) {
    function treatAsUTC(dt) {
        const result = new Date(dt);
        result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
        return result;
    }
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return ((treatAsUTC(endDateTime).getTime() - treatAsUTC(startDateTime).getTime()) / millisecondsPerDay);
}

/**
 * Returns a Date object after parsing a MM-DD-YYYY or MMDDYYYY formated string.
 * @param {string} ds date string to parse
 * @return {Date} date
 */
export function duDateGetFromMMDDYYYY(ds) {
    if (!ds) return "";
    // if format is MM-DD-YYYY (length 10)
    if (ds.length == 10)
        return new Date(parseInt(ds.substring(6, 10)), parseInt(ds.substring(0, 2)) - 1, parseInt(ds.substring(3, 5)));
    // if format is MMDDYYYY (length 8)
    if (ds.length == 8)
        return new Date(parseInt(ds.substring(4, 8)), parseInt(ds.substring(0, 2)) - 1, parseInt(ds.substring(2, 4)));
    return "";
}

/**
 * Returns a Date object after parsing a YYYY-MM-DD formated string.
 * @param {string} ds date string to parse
 * @return {Date} date
 */
export function duGetDateFromYYYYMMDD(ds) {
    // assumes: YYYY-MM-DD
    return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(5, 7)) - 1, parseInt(ds.substring(8, 10)));
}

/**
 * Returns a Date object incremented by one calendar day.
 * @param {Date} d date to be incremented
 * @return {Date} date-plus-one
 */
export function duGetDatePlusOne(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/**
 * Returns a formatted string of the form YYYY-MM-DD from the supplied date.
 * @param {Date} d date to be formatted
 * @return {Date} YYYY-MM-DD
 */
export function duGetISOString(d) {
    if (!d) return "";
    return d.getFullYear().toString() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
}

/**
 * Returns a formatted string of the form MM/DD/YYYY from the supplied date. Note, Months and Days maybe only on digit long (not padded).
 * @param {Date} d date to be formatted
 * @return {Date} MM/DD/YYYY
 */
export function duGetMMDDYYYYString(d) {
    if (!d) return "";
    return (d.getMonth() + 1).toString() + '/' + d.getDate().toString() + '/' + d.getFullYear().toString();
}