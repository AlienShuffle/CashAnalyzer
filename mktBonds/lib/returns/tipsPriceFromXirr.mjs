// Quoted real clean TIPS price from an annual-effective XIRR and projected nominal cash flows.
// Inverse of xirr(). Ported from mybond.xirr.price.gs (mytipsPriceFromXirr).
import { daysBetween, normalizeDate } from "../dates.mjs";
import { accruedInterest } from "../coupons.mjs";
import { roundPrice } from "../rounding.mjs";

/**
 * @param {Date|string} settle
 * @param {Date|string} maturity
 * @param {number} coupon annual real coupon (decimal)
 * @param {number|null} yld annual-effective XIRR (decimal)
 * @param {number} settleIR index ratio at settlement
 * @param {Array<[Date|string, number]>} cashFlows nominal future cash flows as [date, amount, ...]
 * @return {number|null}
 */
export function tipsPriceFromXirr(settle, maturity, coupon, yld, settleIR, cashFlows) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);

    if (yld === null || yld === undefined) return null;
    if (!(settleIR > 0)) throw new Error(`Invalid settlement index ratio=${settleIR}`);
    if (maturityDate < settleDate) return null;
    if (!Array.isArray(cashFlows) || cashFlows.length === 0) throw new Error("No TIPS cash flows supplied");
    if (yld <= -1) throw new Error(`Invalid XIRR=${yld}`);

    let nominalDirtyPV = 0;
    cashFlows.forEach((row, i) => {
        const amount = Number(row[1]);
        if (!Number.isFinite(amount)) throw new Error(`Invalid cash flow at row ${i}`);
        const days = daysBetween(settleDate, normalizeDate(row[0]));
        if (days < 0) throw new Error(`Cash flow precedes settlement at row ${i}`);
        nominalDirtyPV += amount / Math.pow(1 + yld, days / 365); // same 365-day basis as xirr()
    });

    const accrued = accruedInterest(settleDate, maturityDate, coupon);
    return roundPrice(nominalDirtyPV / settleIR - accrued);
}
