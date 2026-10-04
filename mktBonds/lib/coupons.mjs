// Treasury coupon schedule, period facts, and accrued interest.
// Ported from mybond.utils.gs (appscript-src/).
import { dateLessThan, daysBetween, normalizeDate } from "./dates.mjs";
import { roundPrice } from "./rounding.mjs";

/**
 * Move a date by n*6 months, pinned to the maturity day-of-month and clamped to
 * month end (Mar 31 + 6 months -> Sep 30).
 * @param {Date} coupon
 * @param {number} n number of semiannual periods (may be negative)
 * @param {number} maturityDayOfMonth
 * @return {Date}
 */
export function addSemiannualPeriods(coupon, n, maturityDayOfMonth) {
    const newDate = new Date(normalizeDate(coupon));
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + n * 6);
    const lastDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
    newDate.setDate(Math.min(maturityDayOfMonth, lastDay));
    return newDate;
}

/**
 * Coupon dates from settle (inclusive) through maturity (inclusive). The last
 * entry is also the principal repayment date.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @return {Date[]}
 */
export function couponSchedule(settle, maturity) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);
    const maturityDay = maturityDate.getDate();

    const schedule = [maturityDate];
    let d = maturityDate;
    while (true) {
        d = addSemiannualPeriods(d, -1, maturityDay);
        if (dateLessThan(d, settleDate)) break;
        schedule.unshift(d);
    }
    return schedule;
}

function resolveSchedule(settle, maturity, schedule) {
    const sched = Array.isArray(schedule) && schedule.length > 0
        ? schedule
        : couponSchedule(settle, maturity);
    if (sched.length === 0) {
        throw new Error(`bad coupon list for ${settle}=>${maturity}`);
    }
    return sched;
}

/**
 * Last coupon date on or before settlement.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {Date[]} [schedule]
 * @return {Date}
 */
export function lastCoupon(settle, maturity, schedule = []) {
    const sched = resolveSchedule(settle, maturity, schedule);
    return addSemiannualPeriods(sched[0], -1, normalizeDate(maturity).getDate());
}

/**
 * Next coupon date on or after settlement.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {Date[]} [schedule]
 * @return {Date}
 */
export function nextCoupon(settle, maturity, schedule = []) {
    return resolveSchedule(settle, maturity, schedule)[0];
}

/**
 * Key facts about a bond at settlement:
 *   DSC = days to next coupon, E = days in coupon period, A = days accrued,
 *   w = DSC / E (fraction of the period remaining), N = coupons left including maturity.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {Date[]} [schedule]
 * @return {{w:number, lastCoupon:Date, nextCoupon:Date, E:number, DSC:number, A:number, schedule:Date[], N:number}}
 */
export function bondFacts(settle, maturity, schedule = []) {
    const settleDate = normalizeDate(settle);
    const sched = resolveSchedule(settleDate, maturity, schedule);
    const next = sched[0];
    const last = lastCoupon(settleDate, maturity, sched);
    const E = daysBetween(last, next);
    const A = daysBetween(last, settleDate);
    const DSC = daysBetween(settleDate, next);
    const w = DSC / E;

    if (w < 0 || w > 1) throw new Error(`Invalid coupon fraction w=${w}`);

    return { w, lastCoupon: last, nextCoupon: next, E, DSC, A, schedule: sched, N: sched.length };
}

/**
 * Accrued interest per $100 par, actual/actual (nominal, no index ratio applied).
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {number} coupon annual coupon rate (decimal)
 * @param {Date[]} [schedule]
 * @return {number}
 */
export function accruedInterest(settle, maturity, coupon, schedule = []) {
    const { A, E } = bondFacts(settle, maturity, schedule);
    return roundPrice(100 * (coupon / 2) * (A / E));
}
