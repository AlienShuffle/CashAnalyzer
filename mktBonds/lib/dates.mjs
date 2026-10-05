// Date helpers for bond math. Dates are local-midnight Date objects (new Date(y, m, d)).
// Ported from mybond.dates.gs (appscript-src/).

const MS_PER_DAY = 86400000;

/**
 * Convert a date-like value into a Date. Date objects are returned unchanged and
 * YYYY-MM-DD strings are parsed as local midnight. Empty values return null.
 * @param {Date|string|number|null} value
 * @return {Date|null}
 */
export function normalizeDate(value) {
    if (value instanceof Date) return value;
    if (value === "" || value == null) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(value);
}

/**
 * Convert an array of date-like values into Dates, dropping empty values.
 * @param {Array} dateArray
 * @return {Date[]}
 */
export function normalizeDates(dateArray) {
    if (!Array.isArray(dateArray)) return normalizeDate(dateArray);
    return dateArray.flat().map(normalizeDate).filter(d => d !== null);
}

/**
 * Calendar days from a to b. Both ends are normalized to UTC midnight so DST
 * transitions do not distort the count.
 * @param {Date} a
 * @param {Date} b
 * @return {number}
 */
export function daysBetween(a, b) {
    const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return (utc(b) - utc(a)) / MS_PER_DAY;
}

/**
 * Days from a date to the same calendar date one year later (365 or 366), per
 * Treasury's bill investment-rate formula (ofcalc6decbill.pdf).
 * @param {Date} a
 * @return {number}
 */
export function daysInYearFrom(a) {
    return daysBetween(a, new Date(a.getFullYear() + 1, a.getMonth(), a.getDate()));
}

/**
 * Years between two dates: actual/actual under one year, 365.25-day years otherwise.
 * @param {Date} a
 * @param {Date} b
 * @return {number}
 */
export function yearsBetween(a, b) {
    const start = normalizeDate(a);
    const days = daysBetween(start, normalizeDate(b));
    if (days < 365) return days / daysInYearFrom(start);
    return days / 365.25;
}

/**
 * True when both dates fall on the same calendar day.
 * @param {Date} a
 * @param {Date} b
 * @return {boolean}
 */
export function dateEquals(a, b) {
    return daysBetween(a, b) === 0;
}

/**
 * True when startDate is an earlier calendar day than endDate.
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {boolean}
 */
export function dateLessThan(startDate, endDate) {
    return daysBetween(startDate, endDate) > 0;
}

/**
 * Next weekday strictly after a date (Mon-Fri only; holidays are not handled yet).
 * @param {Date|string} value
 * @return {Date}
 */
export function nextWeekday(value) {
    const d = normalizeDate(value);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    return next;
}

function isoLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Next bond-market trading day strictly after a date: skips weekends and the given holidays.
 * @param {Date|string} value trade (report) date
 * @param {Iterable<string>} [holidays] YYYY-MM-DD holiday dates (see lib/holidays.mjs)
 * @return {Date}
 */
export function getSettlementDate(value, holidays = []) {
    const closed = new Set(holidays);
    let next = nextWeekday(value);
    while (closed.has(isoLocal(next))) next = nextWeekday(next);
    return next;
}
