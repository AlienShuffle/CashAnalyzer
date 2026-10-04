// Macaulay and modified duration. Ported from duration.gs (appscript-src/).
import { dateLessThan, normalizeDate } from "./dates.mjs";
import { bondFacts } from "./coupons.mjs";
import { roundTo } from "./rounding.mjs";

/**
 * Macaulay duration in years.
 * @param {Date|string} settle settlement date
 * @param {Date|string} maturity maturity date
 * @param {number} coupon annual coupon rate (decimal)
 * @param {number} yld reference yield (decimal)
 * @return {number|null} null for degenerate inputs (settle >= maturity or yld <= -2)
 */
export function macaulayDuration(settle, maturity, coupon, yld) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);

    if (!dateLessThan(settleDate, maturityDate) || yld <= -2) return null;

    const { w, N } = bondFacts(settleDate, maturityDate);
    const semiCoupon = (coupon || 0) / 2 * 100;
    const r = yld / 2;
    let weighted = 0;
    let pvSum = 0;

    for (let i = 0; i < N; i++) {
        const cf = i === N - 1 ? semiCoupon + 100 : semiCoupon;
        const t = w + i;
        const pv = cf / Math.pow(1 + r, t);
        weighted += t * pv;
        pvSum += pv;
    }
    return roundTo(weighted / pvSum / 2, 5);
}

/**
 * Modified duration in years: Macaulay duration / (1 + yld/2).
 * @param {Date|string} settle settlement date
 * @param {Date|string} maturity maturity date
 * @param {number} coupon annual coupon rate (decimal)
 * @param {number} yld reference yield (decimal)
 * @return {number|null}
 */
export function modifiedDuration(settle, maturity, coupon, yld) {
    const macaulay = macaulayDuration(settle, maturity, coupon, yld);
    if (macaulay === null) return null;
    return roundTo(macaulay / (1 + yld / 2), 5);
}
