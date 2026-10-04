// Canty seasonal adjustment of TIPS real clean prices and yields. Ported from mybond.Canty.gs.
// Reference: Canty, "Seasonality in inflation-linked bonds", Risk, Jan 2009.
import { daysBetween, daysInYearFrom, normalizeDate } from "../dates.mjs";
import { accruedInterest, addSemiannualPeriods, couponSchedule } from "../coupons.mjs";
import { roundPrice, roundYield } from "../rounding.mjs";
import { yieldFromPrice } from "../yield.mjs";

/**
 * Simple Canty price: seasonally adjusted clean price using the settle/maturity factor
 * ratio, with the real accrued interest adjustment.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {number} coupon annual coupon rate (decimal)
 * @param {number} price real clean price
 * @param {number} settleFactor seasonal factor at settlement
 * @param {number} matureFactor seasonal factor at maturity
 * @return {number}
 */
export function simpleCantyPrice(settle, maturity, coupon, price, settleFactor, matureFactor) {
    const saRatio = settleFactor / matureFactor;
    const rai = accruedInterest(settle, maturity, coupon);
    return roundPrice(saRatio * price + rai * (1 - saRatio));
}

/** Real yield of the simple Canty adjusted price. */
export function simpleCanty(settle, maturity, coupon, price, settleFactor, matureFactor) {
    const adjusted = simpleCantyPrice(settle, maturity, coupon, price, settleFactor, matureFactor);
    return roundYield(yieldFromPrice(settle, maturity, coupon, adjusted));
}

/**
 * Full Canty price (formula 17): weights the seasonal ratio by the PV of the cash flows
 * in the first-coupon month versus the maturity month, plus the rai adjustment.
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {number} coupon annual coupon rate (decimal)
 * @param {number} price real clean price
 * @param {number} settleFactor seasonal factor at settlement
 * @param {number} firstCouponFactor seasonal factor at the coupon date six months before maturity
 * @param {number} matureFactor seasonal factor at maturity
 * @return {number|null}
 */
export function fullCantyPrice(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);
    const rate = coupon || 0;

    const matureMonth = maturityDate.getMonth();
    const firstCouponMonth = addSemiannualPeriods(maturityDate, -1, maturityDate.getDate()).getMonth();

    const schedule = couponSchedule(settleDate, maturityDate);
    const N = schedule.length;
    if (N === 0) return null;

    const yearDays = daysInYearFrom(settleDate);
    const years = schedule.map(d => daysBetween(settleDate, d) / yearDays);
    const yld = yieldFromPrice(settleDate, maturityDate, rate, price);

    let w1 = 0;
    let w2 = 0;
    for (let i = 0; i < N; i++) {
        const discountFactor = Math.pow(1 + yld, -years[i]);
        const couponPV = (rate / 2) * discountFactor;
        const couponMonth = schedule[i].getMonth();
        if (couponMonth === firstCouponMonth) w1 += couponPV;
        if (couponMonth === matureMonth) w2 += couponPV;
        if (i === N - 1) w2 += 100 * discountFactor;
    }

    const saRatio = (w1 * (settleFactor / firstCouponFactor) + w2 * (settleFactor / matureFactor)) / (w1 + w2);
    const rai = accruedInterest(settleDate, maturityDate, rate, schedule);
    return roundPrice(saRatio * price + rai * (1 - settleFactor / matureFactor));
}

/** Real yield of the full Canty adjusted price. */
export function fullCanty(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor) {
    const adjusted = fullCantyPrice(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor);
    return roundYield(yieldFromPrice(settle, maturity, coupon, adjusted));
}
