// XIRR solver. Ported from mybond.xirr.gs (appscript-src/).
import { daysBetween, normalizeDates } from "./dates.mjs";
import { roundYield } from "./rounding.mjs";

/**
 * Annualized effective internal rate of return for dated cash flows (not a bond
 * equivalent yield). Uses Newton-Raphson and falls back to bisection.
 *
 * @param {number[]} cashFlows
 * @param {Array<Date|string>} dates ascending; the first date is the valuation date
 * @param {number} [guess=0.05] starting rate for the solver
 * @return {number}
 */
export function xirr(cashFlows, dates, guess = 0.05) {
    return roundYield(solveXirr(cashFlows, normalizeDates(dates), guess));
}

function solveXirr(cf, dates, guess) {
    if (cf.length !== dates.length) {
        throw new Error("XIRR cashFlows and dates must have same length");
    }
    if (!cf.some(v => v > 0) || !cf.some(v => v < 0)) {
        throw new Error("XIRR requires at least one positive and one negative cash flow");
    }
    for (let i = 1; i < dates.length; i++) {
        if (dates[i] < dates[i - 1]) {
            throw new Error("Cash flow dates must be in ascending order");
        }
    }

    const years = dates.map(d => daysBetween(dates[0], d) / 365);

    const xnpv = rate => cf.reduce((sum, v, i) => sum + v / Math.pow(1 + rate, years[i]), 0);
    const dxnpv = rate => cf.reduce(
        (sum, v, i) => sum - years[i] * v / Math.pow(1 + rate, years[i] + 1), 0);

    let rate = guess;
    for (let i = 0; i < 100; i++) {
        const fp = dxnpv(rate);
        if (Math.abs(fp) < 1e-14) break;
        const next = rate - xnpv(rate) / fp;
        if (Math.abs(next - rate) < 1e-12) return next;
        if (next <= -0.999999) break;
        rate = next;
    }

    let low = -0.999;
    let high = 10.0;
    let fLow = xnpv(low);
    let fHigh = xnpv(high);

    while (Math.sign(fLow) === Math.sign(fHigh) && high < 1000) {
        high *= 2;
        fHigh = xnpv(high);
    }
    if (Math.sign(fLow) === Math.sign(fHigh)) {
        throw new Error(`Could not bracket root: low=${fLow} high=${fHigh}`);
    }

    for (let i = 0; i < 300; i++) {
        const mid = (low + high) / 2;
        const fMid = xnpv(mid);
        if (Math.abs(fMid) < 1e-12) return mid;
        if (Math.sign(fMid) === Math.sign(fLow)) {
            low = mid;
            fLow = fMid;
        } else {
            high = mid;
            fHigh = fMid;
        }
    }
    return (low + high) / 2;
}
