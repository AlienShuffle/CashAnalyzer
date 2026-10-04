// Nominal return (XIRR) of a TIPS under a trend-inflation assumption, optionally seasonally
// adjusted. Ported from mybond.xirr.Tips.gs (mybondGraphTipsNominalReturn and wrappers).
//
// Cash flows before the forward date (t1, the latest published REFCPI) use published REFCPI
// and no seasonal factor. Coupons and redemption after it use forwardREFCPI grown at the trend
// inflator and, when seasonal, the factor for each cash-flow date.
// Lookups are injected: getRefCpi(date) for published REFCPI, getFactor(date) for seasonal factors
// (e.g. from createRefCpiTable).
import { daysBetween, normalizeDate } from "../dates.mjs";
import { accruedInterest, couponSchedule } from "../coupons.mjs";
import { roundPrice, roundRefCpi, roundSeasonal, roundYield } from "../rounding.mjs";
import { yieldFromPrice } from "../yield.mjs";
import { xirr } from "../xirr.mjs";

/**
 * Build the cash-flow/analysis table and nominal XIRR for a TIPS.
 * @param {object} p
 * @param {Date|string} p.settle t0
 * @param {Date|string} p.forward t1, the max published REFCPI date
 * @param {Date|string} p.maturity t2
 * @param {number} p.coupon annual real coupon (decimal)
 * @param {number} p.settleRealCP real clean price at t0
 * @param {number|null} p.forwardRealCP real clean price at t1 (null if maturity is before t1)
 * @param {number} p.datedREFCPI REFCPI on the dated date
 * @param {number} p.settleREFCPI REFCPI at t0
 * @param {number} p.forwardREFCPI REFCPI at t1
 * @param {number} p.inflator trend inflation rate (decimal) from t1 to t2
 * @param {boolean} [p.seasonal=false] apply seasonal factors to post-forward cash flows
 * @param {(d:Date)=>number|null} [p.getRefCpi] published REFCPI lookup (needed for pre-forward coupons)
 * @param {(d:Date)=>number|null} [p.getFactor] seasonal factor lookup (needed when seasonal)
 * @return {null|{rate:number, settleYtm:number, settleSaYtm:number, forwardSaYtm:number|null,
 *   settleSaRatio:number, forwardSaRatio:number, totals:object, rows:object[], cashFlows:number[], dates:Date[]}}
 */
export function tipsNominalReturnTable({
    settle, forward, maturity, coupon, settleRealCP, forwardRealCP,
    datedREFCPI, settleREFCPI, forwardREFCPI, inflator,
    seasonal = false, getRefCpi, getFactor,
}) {
    const settleDate = normalizeDate(settle);
    const forwardDate = normalizeDate(forward);
    const maturityDate = normalizeDate(maturity);
    const rate = coupon || 0;
    const noForwardPrice = forwardRealCP === null || forwardRealCP === undefined || forwardRealCP === "";
    const matureBeforeForward = maturityDate < forwardDate || noForwardPrice;

    const factorOf = date => {
        if (!seasonal) return 1;
        const f = getFactor?.(date);
        if (f == null) throw new Error(`No seasonal factor for ${date.toISOString().slice(0, 10)}`);
        return f;
    };

    const daysToForward = daysBetween(settleDate, forwardDate);
    const daysToMaturity = daysBetween(settleDate, maturityDate);
    const settleIR = settleREFCPI / datedREFCPI;

    const maturitySaFactor = factorOf(maturityDate);
    const settleSaRatio = seasonal ? factorOf(settleDate) / maturitySaFactor : 1;
    const forwardSaRatio = seasonal ? factorOf(forwardDate) / maturitySaFactor : 1;

    const schedule = couponSchedule(settleDate, maturityDate);
    if (schedule.length === 0) return null;

    const settleAccruedReal = accruedInterest(settleDate, maturityDate, rate, schedule);
    const settleAccruedNominal = settleIR * settleAccruedReal;
    const settleNominalDirty = settleIR * (settleRealCP + settleAccruedReal);

    const dailyRealDiscount = (100 - settleRealCP) / daysToMaturity;
    const totalKnownInflation = 100 * (forwardREFCPI - settleREFCPI) / datedREFCPI;
    const totalKnownRealDiscount = matureBeforeForward ? 0 : forwardRealCP - settleRealCP;
    const dailyKnownRealDiscount = totalKnownRealDiscount / daysToForward;

    const N = schedule.length;
    const semiRealCoupon = 100 * rate / 2;
    const rows = [];

    let cumTrendInflation = 0;
    let cumKnownInflation = 0;
    let cumFutureInflation = 0;
    let lastCouponREFCPI = settleREFCPI;
    let cumCoupon = 0;
    let cumDiscount = 0;
    let cumKnownDiscount = 0;
    let lastDiscountDate = settleDate;
    let cumSA = 0;

    for (let i = 0; i < N; i++) {
        const couponDate = schedule[i];
        const fwdYrs = daysBetween(forwardDate, couponDate) / 365;
        const preFwdCoupon = couponDate < forwardDate;
        if (matureBeforeForward && !preFwdCoupon) {
            throw new Error("maturity is before forward but a coupon falls on/after forward");
        }

        let couponREFCPI;
        if (preFwdCoupon) {
            couponREFCPI = getRefCpi?.(couponDate);
            if (couponREFCPI == null) {
                throw new Error(`No published REFCPI for pre-forward coupon ${couponDate.toISOString().slice(0, 10)}`);
            }
        } else {
            couponREFCPI = forwardREFCPI * Math.pow(1 + inflator, fwdYrs);
        }

        const couponIR = couponREFCPI / datedREFCPI;
        const couponSaFactor = factorOf(couponDate);
        const flow = (preFwdCoupon ? 1 : couponSaFactor) * couponIR * (semiRealCoupon + (i === N - 1 ? 100 : 0));

        const currTrendInflation = 100 * (couponREFCPI - lastCouponREFCPI) / datedREFCPI;
        cumTrendInflation += currTrendInflation;
        lastCouponREFCPI = couponREFCPI;

        const currKnownInflation = preFwdCoupon ? currTrendInflation : totalKnownInflation - cumKnownInflation;
        cumKnownInflation += currKnownInflation;

        const currFutureInflation = preFwdCoupon ? 0 : currTrendInflation - currKnownInflation;
        cumFutureInflation += currFutureInflation;

        const currCoupon = couponIR * semiRealCoupon - (i === 0 ? settleAccruedNominal : 0);
        cumCoupon += currCoupon;

        const accrualDays = daysBetween(lastDiscountDate, couponDate);
        const currDiscount = couponIR * dailyRealDiscount * accrualDays;
        cumDiscount += currDiscount;

        const currKnownDiscount = preFwdCoupon
            ? dailyKnownRealDiscount * accrualDays
            : totalKnownRealDiscount - cumKnownDiscount;
        cumKnownDiscount += currKnownDiscount;
        lastDiscountDate = couponDate;

        // returns after the forward date; currSA is the net effect of the factor on them
        const currTotalReturnSA = currFutureInflation + (preFwdCoupon ? 0 : currCoupon + currDiscount - currKnownDiscount);
        const currSA = couponSaFactor * currTotalReturnSA - currTotalReturnSA;
        cumSA += currSA;

        rows.push({
            date: couponDate,
            cashflow: roundPrice(flow),
            cumKnownInflation: roundPrice(cumKnownInflation),
            cumFutureInflation: roundPrice(cumFutureInflation),
            cumCoupon: roundPrice(cumCoupon),
            cumDiscount: roundPrice(cumDiscount),
            cumSA: roundPrice(cumSA),
            currKnownInflation: roundPrice(currKnownInflation),
            currFutureInflation: roundPrice(currFutureInflation),
            currCoupon: roundPrice(currCoupon),
            currDiscount: roundPrice(currDiscount),
            currSA: roundPrice(currSA),
            currTrendInflation: roundPrice(currTrendInflation),
            couponIR: roundRefCpi(couponIR),
            couponSaFactor: roundSeasonal(couponSaFactor),
            currTotalReturnSA: roundPrice(currTotalReturnSA),
        });
    }

    const cashFlows = [roundPrice(-settleNominalDirty), ...rows.map(r => r.cashflow)];
    const dates = [settleDate, ...rows.map(r => r.date)];

    return {
        rate: roundYield(xirr(cashFlows, dates, 0.10)),
        settleYtm: roundYield(yieldFromPrice(settleDate, maturityDate, rate, settleRealCP)),
        settleSaYtm: roundYield(yieldFromPrice(settleDate, maturityDate, rate, settleRealCP * settleSaRatio)),
        forwardSaYtm: matureBeforeForward
            ? null
            : roundYield(yieldFromPrice(forwardDate, maturityDate, rate, forwardRealCP * forwardSaRatio)),
        settleSaRatio: roundSeasonal(settleSaRatio),
        forwardSaRatio: roundSeasonal(forwardSaRatio),
        totals: {
            cumKnownInflation: roundPrice(cumKnownInflation),
            cumFutureInflation: roundPrice(cumFutureInflation),
            cumCoupon: roundPrice(cumCoupon),
            cumDiscount: roundPrice(cumDiscount),
            cumSA: roundPrice(cumSA),
            cumTrendInflation: roundPrice(cumTrendInflation),
        },
        rows,
        cashFlows,
        dates,
    };
}

/** Nominal XIRR of a TIPS under trend inflation; null if there are no cash flows. */
export function tipsNominalReturn(params) {
    const table = tipsNominalReturnTable(params);
    return table === null ? null : table.rate;
}

/** As tipsNominalReturn with no seasonal adjustment. */
export function tipsNominalReturnFromTrendInflation(params) {
    return tipsNominalReturn({ ...params, seasonal: false });
}
