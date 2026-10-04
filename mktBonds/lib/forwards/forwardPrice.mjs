// Forward clean prices of TIPS and nominal Treasuries by repo/T-bill carry.
// Ported from mybond.fwd.tips.calcFwdCP.gs and mybond.fwd.nom.calcFwdCP.gs.
import { daysBetween, daysInYearFrom, normalizeDate } from "../dates.mjs";
import { accruedInterest, couponSchedule } from "../coupons.mjs";
import { roundPrice } from "../rounding.mjs";

/**
 * Forward quoted real clean price of a TIPS. Carries the indexed dirty value from settlement
 * (t0) to the forward date (t1), removing coupons paid strictly before t1 (each valued at its
 * coupon-date index ratio and carried to t1).
 *
 * @param {object} p
 * @param {Date|string} p.settle t0
 * @param {Date|string} p.forward t1
 * @param {Date|string} p.maturity
 * @param {number} p.coupon annual real coupon (decimal)
 * @param {number} p.price current real clean price
 * @param {number} p.datedRefCpi
 * @param {number} p.settleRefCpi
 * @param {number} p.forwardRefCpi
 * @param {number} p.repoRate repo/T-bill financing rate (decimal)
 * @param {(d:Date)=>number|null} p.getRefCpi published REFCPI lookup (for intervening coupons)
 * @return {number|null} null when the price is invalid or the forward date is after maturity
 */
export function forwardTipsCleanPrice({
    settle, forward, maturity, coupon, price, datedRefCpi, settleRefCpi, forwardRefCpi, repoRate, getRefCpi,
}) {
    const settleDate = normalizeDate(settle);
    const forwardDate = normalizeDate(forward);
    const maturityDate = normalizeDate(maturity);

    if (forwardDate < settleDate) throw new Error("Forward date cannot precede settlement date");
    if (maturityDate < forwardDate) return null;
    if (datedRefCpi <= 0 || settleRefCpi <= 0 || forwardRefCpi <= 0) {
        throw new Error("REFCPI values must be positive");
    }
    if (!price || price <= 0) return null;

    const rate = coupon || 0;
    const realDirty0 = price + accruedInterest(settleDate, maturityDate, rate);
    const indexedDirty0 = realDirty0 * (settleRefCpi / datedRefCpi);

    const days = daysBetween(settleDate, forwardDate);
    const carried = indexedDirty0 * (1 + repoRate * days / daysInYearFrom(settleDate));

    let indexedCouponFV = 0;
    for (const couponDate of couponSchedule(settleDate, maturityDate)) {
        if (!(couponDate < forwardDate)) break;
        const couponRefCpi = getRefCpi?.(couponDate);
        if (couponRefCpi == null) {
            throw new Error(`No published REFCPI for intervening coupon ${couponDate.toISOString().slice(0, 10)}`);
        }
        const indexedCoupon = (couponRefCpi / datedRefCpi) * 100 * rate / 2;
        const carryDays = daysBetween(couponDate, forwardDate);
        indexedCouponFV += indexedCoupon * (1 + repoRate * carryDays / daysInYearFrom(couponDate));
    }

    const realDirty1 = (carried - indexedCouponFV) / (forwardRefCpi / datedRefCpi);
    return roundPrice(realDirty1 - accruedInterest(forwardDate, maturityDate, rate));
}

/**
 * Forward quoted clean price of a nominal note or bond. Coupons on or before the forward date
 * belong to the current holder and are removed (ex-coupon on t1).
 * @return {number|null} null when the price is invalid or the forward date is after maturity
 */
export function forwardNominalCleanPrice({ settle, forward, maturity, coupon, price, repoRate }) {
    const settleDate = normalizeDate(settle);
    const forwardDate = normalizeDate(forward);
    const maturityDate = normalizeDate(maturity);

    if (forwardDate < settleDate) throw new Error("Forward date cannot precede settlement date");
    if (maturityDate < forwardDate) return null;

    const rate = Number(coupon);
    const cleanPrice = Number(price);
    const repo = Number(repoRate);
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) return null;
    if (!Number.isFinite(rate) || rate < 0) throw new Error("Invalid coupon");
    if (!Number.isFinite(repo)) throw new Error("Invalid repo rate");

    const dirty0 = cleanPrice + accruedInterest(settleDate, maturityDate, rate);
    const days = daysBetween(settleDate, forwardDate);
    const carried = dirty0 * (1 + repo * days / daysInYearFrom(settleDate));

    const couponAmount = 100 * rate / 2;
    let couponFV = 0;
    for (const couponDate of couponSchedule(settleDate, maturityDate)) {
        if (forwardDate < couponDate) break;
        const carryDays = daysBetween(couponDate, forwardDate);
        couponFV += carryDays === 0
            ? couponAmount
            : couponAmount * (1 + repo * carryDays / daysInYearFrom(couponDate));
    }

    return roundPrice(carried - couponFV - accruedInterest(forwardDate, maturityDate, rate));
}
