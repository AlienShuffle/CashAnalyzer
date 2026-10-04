// Clean price from bond equivalent yield. Ported from mybond.priceFromYield.gs (appscript-src/).
// The seasonally adjusted variant (mySaPriceFromYield) was marked incomplete in the
// source and is deferred to the TIPS/SA layer.
import { dateLessThan, normalizeDate } from "./dates.mjs";
import { accruedInterest, bondFacts } from "./coupons.mjs";
import { roundPrice } from "./rounding.mjs";

/**
 * Clean price per $100 for a yield, with semiannual compounding on Treasury coupons
 * and calendar (Excel PRICE basis 1, frequency 2).
 *
 * @param {Date|string} settle settlement date
 * @param {Date|string} maturity maturity date
 * @param {number} coupon annual coupon rate (decimal)
 * @param {number} yld annual yield (decimal)
 * @return {number|null} clean price, or null when the yield is missing or the bond has matured
 */
export function priceFromYield(settle, maturity, coupon, yld) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);
    const rate = coupon || 0;

    if (yld === null || yld === undefined) return null;
    if (dateLessThan(maturityDate, settleDate)) return null;

    const { w, N, schedule } = bondFacts(settleDate, maturityDate);
    const accrued = accruedInterest(settleDate, maturityDate, rate, schedule);

    let pv = 0;
    for (let i = 0; i < N; i++) {
        const cf = 100 * ((i === N - 1 ? 1 : 0) + rate / 2);
        pv += cf / Math.pow(1 + yld / 2, w + i);
    }
    return roundPrice(pv - accrued);
}
