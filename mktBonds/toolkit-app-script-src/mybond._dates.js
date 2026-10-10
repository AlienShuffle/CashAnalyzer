// mybond.dates.gs
// partially adapted from aerokam

/**
 * Date objects here are local-midnight timestamps (`new Date(y, m, d)`). Diffing
 * their .getTime() values directly is WRONG whenever the interval crosses a DST
 * transition: the local clock gains/loses an hour, so the ms delta is off by
 * ±3,600,000ms (±1/24 day ≈ ±0.0417) from the true calendar-day count. Normalizing
 * both endpoints to UTC-midnight before diffing removes the DST artifact.
 * ajg note - this is a different implementation than a I have used in the past. I always tried
 * to rectify that date by time zone cleanup, but this appears to be more reliable IF the
 * date is always set to midnight local time. Every choice has it's risks.
 * 
 * @param {Date} a first date
 * @param {Date} b second date
 * @return {number} days
 */
function mydateDaysBetween_(a, b) {
  const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return (utc(b) - utc(a)) / 86400000;   // 1000 * 60 * 60 * 24 ms in a day
}

/**
 * Days in the year following a given date.
 * Per Treasury's Treasury-bill investment-rate formula (ofcalc6decbill.pdf, "Price,
 * Yield and Rate Calculations for a Treasury Bill"): y = the actual number of days
 * from settlement to the same calendar date one year later — 365, or 366 if that
 * twelve-month span crosses Feb 29. This is NOT the same question as whether the
 * (shorter) settlement-to-maturity window itself contains Feb 29 — a short bill
 * settling in January and maturing in February, for example, never reaches Feb 29
 * in its own window even in a leap year, but still uses y=366 because the year
 * following settlement does. Spec: 1.0 Bond Basics §Treasury Bill Yield.
 * @param {Date} a date in question
 * @return {number}
 */
function mydateDaysInYearFrom_(a) {
  const oneYearLater = new Date(a.getFullYear() + 1, a.getMonth(), a.getDate());
  return mydateDaysBetween_(a, oneYearLater);
}

/**
 * Assume Date objects here are local-midnight timestamps (`new Date(y, m, d)`). Diffing
 * their .getTime() values directly is WRONG whenever the interval crosses a DST
 * transition: the local clock gains/loses an hour, so the ms delta is off by
 * ±3,600,000ms (±1/24 day ≈ ±0.0417) from the true calendar-day count. Normalizing
 * both endpoints to UTC-midnight before diffing removes the DST artifact.
 * Under 1 year: actual/actual (365, or 366 per daysInYearFrom above).
 * 1 year or more: 365.25, the long-run average that avoids a single term's
 * leap-year placement skewing a multi-year figure.
 * 
 * @param {Date} a first date
 * @param {Date} b second date
 * @return {number}
 */
function mydateYearsBetween_(a, b) {
  const daysToMat = mydateDaysBetween_(mydateNormalize_(a), mydateNormalize_(b));
  if (daysToMat < 365) {
    return daysToMat / mydateDaysInYearFrom_(a);
  }
  return daysToMat / 365.25;
}

/**
 * Calculated if startDate is earlier than endDate only using actual dates/days, ignores minutes/seconds in the date in local time.
 * @param {Date} a first date
 * @param {Date} b second date
 * @return {Boolean} result
 */
function mydateIsEqual_(a, b) {
  if (a.getFullYear() != b.getFullYear()) return false;
  if (a.getMonth() != b.getMonth()) return false;
  if (a.getDate() != b.getDate()) return false;
  return true;
}

/**
 * Calculated if startDate is earlier than endDate only using actual dates/days, ignores minutes/seconds in the date in local time.
 * @param {Date} startDate first date
 * @param {Date} endDate second date
 * @return {Boolean} result
 */
function mydateLessThan_(startDate, endDate) {
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
 * Convert a date-like value into Date object.
 * Existing Date objects are left unchanged. This is especially useful for handling
 * externally created date string in Google Sheets or a website .csv or .json file.
 * It may return null.
 *
 * @param {object/string} string or Date Object
 * @returns {Date}
 */
function mydateNormalize_(value) {
  // Already a Date
  if (value instanceof Date) {
    return value;
  }
  // Empty cell
  if (value === "" || value == null) {
    return null;
  }
  // YYYY-MM-DD string (ISO)
  if (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // Any other date-like value
  return new Date(value);
}

/**
 * Convert an array of date-like values into Date objects.
 * Existing Date objects are left unchanged.
 * null results are filtered out.
 *
 * @param {Array} dateArray
 * @returns {Date[]}
 */
function mydatesNormalize_(dateArray) {
  if (!Array.isArray(dateArray))
    return mydateNormalize_(dateArray);
  return dateArray.flat().map(value => {
    return mydateNormalize_(value);
  }).filter(d => d !== null);
}
