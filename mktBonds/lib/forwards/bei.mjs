// Break-even inflation (BEI) solver. Ported from mybond.beiSolver.gs (identical to
// zobe.mybond.beiSolver.gs). The original notes the BEI solver adds noise versus using the
// seasonally adjusted forward yield directly; it is kept as a generic-solver pattern.
// The original mybondBEISolver wrapper passed cleanPrice and coupon in swapped order to the
// SA solver; only the SA solver is ported, with a single, documented argument order.
import { daysBetween, normalizeDate } from "../dates.mjs";
import { accruedInterest, bondFacts } from "../coupons.mjs";
import { roundYield } from "../rounding.mjs";

/**
 * Bisection root finder. Throws if the root is not bracketed by [low, high].
 * @param {(x:number)=>number} errorFunc
 */
export function binarySolver(errorFunc, low = -0.10, high = 0.20, tolerance = 1e-12, maxIterations = 200) {
    const errorLow = errorFunc(low);
    const errorHigh = errorFunc(high);
    if (Math.sign(errorLow) === Math.sign(errorHigh)) {
        throw new Error(`Root not bracketed. Error(low)=${errorLow}, Error(high)=${errorHigh}`);
    }

    let lo = low;
    let hi = high;
    let loError = errorLow;
    let mid;
    for (let i = 0; i < maxIterations; i++) {
        mid = (lo + hi) / 2;
        const errorMid = errorFunc(mid);
        if (Math.abs(errorMid) < tolerance) return mid;
        if (errorMid * loError < 0) {
            hi = mid;
        } else {
            lo = mid;
            loError = errorMid;
        }
    }
    return mid;
}

/**
 * Seasonally adjusted break-even inflation rate: the trend inflation that makes the discounted
 * projected TIPS cash flows (discounted at the Treasury yield) equal the forward dirty value.
 * @param {object} p
 * @param {Date|string} p.forward forward settlement date
 * @param {Date|string} p.maturity
 * @param {number} p.coupon annual real coupon (decimal)
 * @param {number} p.cleanPrice forward real clean price
 * @param {number} p.datedREFCPI
 * @param {number} p.fwdREFCPI
 * @param {number} p.treasuryYield semiannual-compounded Treasury yield (decimal)
 * @param {(d:Date)=>number|null} [p.getFactor] seasonal factor lookup; omit for no seasonal adjustment
 */
export function beiSolverSA({ forward, maturity, coupon, cleanPrice, datedREFCPI, fwdREFCPI, treasuryYield, getFactor }) {
    const forwardDate = normalizeDate(forward);
    const maturityDate = normalizeDate(maturity);
    const rate = coupon || 0;

    const { w, N, schedule } = bondFacts(forwardDate, maturityDate);
    const rai = accruedInterest(forwardDate, maturityDate, rate, schedule);
    const fwdDirtyPrice = (cleanPrice + rai) * (fwdREFCPI / datedREFCPI);

    const factorOf = date => {
        if (!getFactor) return 1;
        const f = getFactor(date);
        if (f == null) throw new Error(`No seasonal factor for ${date.toISOString().slice(0, 10)}`);
        return f;
    };
    const maturityFactor = factorOf(maturityDate);

    const errorFunc = inflator => {
        let pv = 0;
        for (let i = 0; i < N; i++) {
            const couponDate = schedule[i];
            const yrs = daysBetween(forwardDate, couponDate) / 365;
            const projectedIR = fwdREFCPI * Math.pow(1 + inflator, yrs) / datedREFCPI;
            const saRatio = factorOf(couponDate) / maturityFactor;
            const cf = 100 * projectedIR * saRatio * ((i === N - 1 ? 1 : 0) + rate / 2);
            pv += cf / Math.pow(1 + treasuryYield / 2, w + i);
        }
        return pv - fwdDirtyPrice;
    };

    return roundYield(binarySolver(errorFunc));
}
