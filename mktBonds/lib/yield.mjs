// Bond equivalent yield from clean price. Ported from mybond.yieldFromPrice.gs (appscript-src/).
import { dateLessThan, daysBetween, daysInYearFrom, normalizeDate } from "./dates.mjs";
import { accruedInterest, bondFacts } from "./coupons.mjs";
import { roundYield } from "./rounding.mjs";

/**
 * Treasury coupon-equivalent yield from a clean price. Assumes Treasury coupons and
 * calendar (Excel YIELD basis 1, frequency 2). Zero-coupon securities with under six
 * months to maturity use Treasury's investment-rate formula. Results can differ from
 * Excel by a few basis points in the final coupon period (N=1).
 *
 * @param {Date|string} settle settlement date
 * @param {Date|string} maturity maturity date
 * @param {number} coupon annual coupon rate (decimal); empty/null is treated as zero
 * @param {number} price clean price per $100 (real price for TIPS)
 * @param {number} [redemption=100] value at redemption; use a nominal amount for nominal returns
 * @return {number|null} annual yield (decimal), or null for degenerate inputs
 */
export function yieldFromPrice(settle, maturity, coupon, price, redemption = 100) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);
    const rate = coupon || 0;

    if (!price || price <= 0) return null;
    if (!dateLessThan(settleDate, maturityDate)) return null;

    const yrs = daysBetween(settleDate, maturityDate) / daysInYearFrom(settleDate);

    if (rate === 0 && yrs < 0.5) {
        return roundYield((redemption / price - 1) / yrs);
    }

    const { w, schedule, N } = bondFacts(settleDate, maturityDate);
    const dirtyPrice = price + accruedInterest(settleDate, maturityDate, rate, schedule);

    const cashFlow = i => redemption * ((i === N - 1 ? 1 : 0) + rate / 2);

    // semiannual compounding: discount each flow by (1 + y/2)^(w + i)
    function pv(yld) {
        if (yld <= -1.99) return Number.POSITIVE_INFINITY;
        let value = 0;
        for (let i = 0; i < N; i++) {
            value += cashFlow(i) / Math.pow(1 + yld / 2, w + i);
        }
        return value;
    }

    function dpv(yld) {
        let deriv = 0;
        for (let i = 0; i < N; i++) {
            const exponent = w + i;
            deriv += -exponent * cashFlow(i) / (2 * Math.pow(1 + yld / 2, exponent + 1));
        }
        return deriv;
    }

    let yld = rate > 0.005 ? rate : 0.02;
    for (let i = 0; i < 200; i++) {
        const diff = pv(yld) - dirtyPrice;
        if (Math.abs(diff) < 1e-10) break;
        const deriv = dpv(yld);
        if (Math.abs(deriv) < 1e-15) break;
        yld -= diff / deriv;
    }

    return roundYield(yld);
}
