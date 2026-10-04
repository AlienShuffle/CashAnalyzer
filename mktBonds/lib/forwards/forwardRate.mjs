// Forward rates. Ported from mybond.forwards.gs (identical to mybond.fwd.rates.gs).
import { daysBetween, normalizeDate } from "../dates.mjs";
import { roundYield } from "../rounding.mjs";

/**
 * Forward rate from t1 to t2 given annual rates r1 (t0..t1) and r2 (t0..t2):
 * ((1+r2)^t2 / (1+r1)^t1)^(1/(t2-t1)) - 1. Times are years on a consistent basis.
 */
export function forwardRate(r1, t1, r2, t2) {
    if (r1 <= -1 || r2 <= -1) throw new Error("Rates must exceed -100%");
    return roundYield(Math.pow(Math.pow(1 + r2, t2) / Math.pow(1 + r1, t1), 1 / (t2 - t1)) - 1);
}

/**
 * Forward rate between a forward date (t1) and maturity (t2) using 365-day years.
 * Returns null when t2 <= t1 (everything is already known).
 * @param {Date|string} settle t0
 * @param {Date|string} forward t1
 * @param {Date|string} maturity t2
 * @param {number} rForward rate t0..t1 (decimal)
 * @param {number} rMaturity rate t0..t2 (decimal)
 */
export function easyForward(settle, forward, maturity, rForward, rMaturity) {
    const settleDate = normalizeDate(settle);
    const t1 = daysBetween(settleDate, normalizeDate(forward)) / 365;
    const t2 = daysBetween(settleDate, normalizeDate(maturity)) / 365;
    if (t2 <= t1) return null;
    return forwardRate(rForward, t1, rMaturity, t2);
}
