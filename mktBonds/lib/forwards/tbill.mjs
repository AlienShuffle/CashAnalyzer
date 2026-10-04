// Treasury-bill discount factors and simple rates interpolated between two bills.
// Ported from discount.gs (identical to fwd.tbill.calc.discount.gs) and fwd.tbill.calc.simple.gs.
import { daysBetween, daysInYearFrom, normalizeDate } from "../dates.mjs";

/**
 * Discount factor from settlement to a target date by log-linear interpolation of two bills.
 * Prices are per $100 maturity value. The target must lie between the maturities (bill 1 earlier).
 */
export function tbillDiscountFactor(settle, target, maturity1, price1, maturity2, price2) {
    const settleDate = normalizeDate(settle);
    const t = daysBetween(settleDate, normalizeDate(target));
    const t1 = daysBetween(settleDate, normalizeDate(maturity1));
    const t2 = daysBetween(settleDate, normalizeDate(maturity2));

    if (t1 === t2) throw new Error("T-bill maturities must be different");
    if (t < t1 || t > t2) throw new Error("Target date is not bracketed by T-bill maturities");

    const df1 = Number(price1) / 100;
    const df2 = Number(price2) / 100;
    if (!(df1 > 0) || !(df2 > 0)) throw new Error("Invalid T-bill price");

    const w = (t - t1) / (t2 - t1);
    return Math.exp(Math.log(df1) + w * (Math.log(df2) - Math.log(df1)));
}

/**
 * Simple annualized rate to a target date from two bills: 1/DF = 1 + r*days/yearDays.
 * Same-maturity bills must both mature on the target; their simple rates are averaged.
 * @return {number} decimal rate
 */
export function tbillSimpleRate(settle, target, maturity1, price1, maturity2, price2) {
    const settleDate = normalizeDate(settle);
    const targetDays = daysBetween(settleDate, normalizeDate(target));
    const days1 = daysBetween(settleDate, normalizeDate(maturity1));
    const days2 = daysBetween(settleDate, normalizeDate(maturity2));

    if (targetDays <= 0) throw new Error("Target date must be after settlement date");
    if (days1 <= 0 || days2 <= 0) throw new Error("T-bill maturities must be after settlement date");

    const p1 = Number(price1);
    const p2 = Number(price2);
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 <= 0 || p2 <= 0) {
        throw new Error("Invalid T-bill price");
    }
    const df1 = p1 / 100;
    const df2 = p2 / 100;
    const yearDays = daysInYearFrom(settleDate);

    if (days1 === days2) {
        if (targetDays !== days1) throw new Error("Same-maturity T-bills do not bracket the target date");
        return ((1 / df1 - 1) * yearDays / days1 + (1 / df2 - 1) * yearDays / days2) / 2;
    }

    if (targetDays < Math.min(days1, days2) || targetDays > Math.max(days1, days2)) {
        throw new Error("Target date is not bracketed by T-bill maturities");
    }

    const w = (targetDays - days1) / (days2 - days1);
    const targetDf = Math.exp(Math.log(df1) + w * (Math.log(df2) - Math.log(df1)));
    return (1 / targetDf - 1) * yearDays / targetDays;
}
