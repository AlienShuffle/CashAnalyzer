// Svensson real zero-coupon curve fitted to TIPS clean prices, plus per-bond analysis against
// the fit. Ported from mybond.zero-coupon.gs. The Sheets wrappers (range flattening, 2D output
// table) became plain object inputs and outputs.
import { daysBetween, normalizeDate } from "../dates.mjs";
import { accruedInterest, couponSchedule } from "../coupons.mjs";
import { macaulayDuration } from "../duration.mjs";
import { roundPrice } from "../rounding.mjs";
import { yieldFromPrice } from "../yield.mjs";

/**
 * Svensson continuously compounded zero rate.
 * @param {number} t years
 * @param {number[]} p [beta0, beta1, beta2, beta3, tau1, tau2]
 */
export function svenssonZero(t, p) {
    const [b0, b1, b2, b3, tau1, tau2] = p;
    if (t <= 0) return b0 + b1;

    const x1 = t / tau1;
    const e1 = Math.exp(-x1);
    const a1 = (1 - e1) / x1;
    const x2 = t / tau2;
    const e2 = Math.exp(-x2);
    return b0 + b1 * a1 + b2 * (a1 - e1) + b3 * ((1 - e2) / x2 - e2);
}

/** Svensson discount factor at term t (years). */
export function svenssonDF(t, p) {
    return Math.exp(-svenssonZero(t, p) * t);
}

/**
 * Model dirty price per $100 from individually discounted real cash flows (365-day years).
 * @return {number|null} null if there are no cash flows
 */
export function tipsZeroModelPrice(settle, maturity, coupon, params) {
    const settleDate = normalizeDate(settle);
    const schedule = couponSchedule(settleDate, normalizeDate(maturity));
    if (schedule.length === 0) return null;

    const couponCF = 100 * (coupon || 0) / 2;
    let dirtyPV = 0;
    for (let i = 0; i < schedule.length; i++) {
        const t = daysBetween(settleDate, schedule[i]) / 365;
        const cf = couponCF + (i === schedule.length - 1 ? 100 : 0);
        dirtyPV += cf * svenssonDF(t, params);
    }
    return dirtyPV;
}

/** Model dirty minus market dirty price for one bond ({maturity, coupon, cleanPrice}). */
export function tipsZeroResidual(settle, bond, params) {
    const marketDirty = bond.cleanPrice + accruedInterest(settle, bond.maturity, bond.coupon);
    return tipsZeroModelPrice(settle, bond.maturity, bond.coupon, params) - marketDirty;
}

// Fast Svensson zero used inside the fitting loop.
function fastZero(t, b0, b1, b2, b3, tau1, tau2) {
    if (t <= 0) return b0 + b1;
    const x1 = t / tau1;
    const e1 = Math.exp(-x1);
    const a1 = (1 - e1) / x1;
    const x2 = t / tau2;
    const e2 = Math.exp(-x2);
    return b0 + b1 * a1 + b2 * (a1 - e1) + b3 * ((1 - e2) / x2 - e2);
}

/**
 * Fit a Svensson curve to TIPS dirty prices with inverse-duration weights (GSW style) using a
 * tau grid with beta coordinate descent, then a six-parameter local refinement.
 * @param {Date|string} settle
 * @param {Array<{maturity:Date|string, coupon:number, cleanPrice:number}>} bonds at least 6 usable
 * @return {{params:number[], objective:number}}
 */
export function fitTipsSvensson(settle, bonds) {
    const settleDate = normalizeDate(settle);
    if (!Array.isArray(bonds) || bonds.length < 6) {
        throw new Error(`Svensson fit requires at least 6 bonds; found ${bonds?.length ?? 0}`);
    }

    const prepared = [];
    for (const bond of bonds) {
        const maturityDate = normalizeDate(bond.maturity);
        const coupon = Number(bond.coupon);
        const cleanPrice = Number(bond.cleanPrice);
        if (!Number.isFinite(coupon) || !Number.isFinite(cleanPrice) || cleanPrice <= 0) continue;
        if (!(settleDate < maturityDate)) continue;

        const schedule = couponSchedule(settleDate, maturityDate);
        if (schedule.length === 0) continue;

        const marketDirty = cleanPrice + accruedInterest(settleDate, maturityDate, coupon, schedule);
        const times = schedule.map(d => daysBetween(settleDate, d) / 365);
        const cashFlows = schedule.map((_, i) => 100 * (coupon / 2 + (i === schedule.length - 1 ? 1 : 0)));

        const marketYld = yieldFromPrice(settleDate, maturityDate, coupon, cleanPrice);
        if (!Number.isFinite(marketYld)) continue;
        const duration = macaulayDuration(settleDate, maturityDate, coupon, marketYld);
        if (!Number.isFinite(duration) || duration <= 0) continue;

        prepared.push({ marketDirty, times, cashFlows, weight: 1 / duration });
    }
    if (prepared.length < 6) {
        throw new Error(`Insufficient usable bonds for Svensson fit: ${prepared.length}`);
    }

    function objective(p) {
        const [b0, b1, b2, b3, tau1, tau2] = p;
        if (tau1 <= 0.05 || tau2 <= 0.05) return Number.POSITIVE_INFINITY;
        let sse = 0;
        for (const bond of prepared) {
            let pv = 0;
            for (let i = 0; i < bond.times.length; i++) {
                const t = bond.times[i];
                pv += bond.cashFlows[i] * Math.exp(-fastZero(t, b0, b1, b2, b3, tau1, tau2) * t);
            }
            const error = pv - bond.marketDirty;
            sse += bond.weight * error * error;
        }
        return sse;
    }

    let p = [0.0200, -0.0050, 0.0050, 0.0000, 1.50, 6.00];
    const tau1Grid = [0.5, 1, 1.5, 2, 3];
    const tau2Grid = [3, 4, 5, 7, 10, 15, 20, 30];

    let best = Number.POSITIVE_INFINITY;
    let bestP = p.slice();

    for (const tau1 of tau1Grid) {
        for (const tau2 of tau2Grid) {
            if (Math.abs(tau1 - tau2) < 0.10) continue;

            const candidate = [p[0], p[1], p[2], p[3], tau1, tau2];
            let candidateValue = objective(candidate);
            const betaSteps = [0.0025, 0.0025, 0.0025, 0.0025];

            for (let iteration = 0; iteration < 60; iteration++) {
                let improved = false;
                for (let j = 0; j < 4; j++) {
                    const original = candidate[j];

                    candidate[j] = original - betaSteps[j];
                    let value = objective(candidate);
                    if (value < candidateValue) {
                        candidateValue = value;
                        improved = true;
                        continue;
                    }

                    candidate[j] = original + betaSteps[j];
                    value = objective(candidate);
                    if (value < candidateValue) {
                        candidateValue = value;
                        improved = true;
                        continue;
                    }
                    candidate[j] = original;
                }
                if (!improved) {
                    let maxStep = 0;
                    for (let j = 0; j < 4; j++) {
                        betaSteps[j] *= 0.5;
                        maxStep = Math.max(maxStep, betaSteps[j]);
                    }
                    if (maxStep < 1e-7) break;
                }
            }

            if (candidateValue < best) {
                best = candidateValue;
                bestP = candidate.slice();
            }
        }
    }

    p = bestP.slice();
    const steps = [0.00025, 0.00025, 0.00025, 0.00025, 0.10, 0.25];
    best = objective(p);

    for (let iteration = 0; iteration < 100; iteration++) {
        let improved = false;
        for (let j = 0; j < 6; j++) {
            const original = p[j];

            if ((j === 4 || j === 5) && original - steps[j] <= 0.05) {
                p[j] = original;
            } else {
                p[j] = original - steps[j];
                const value = objective(p);
                if (value < best) {
                    best = value;
                    improved = true;
                    continue;
                }
                p[j] = original;
            }

            p[j] = original + steps[j];
            const value = objective(p);
            if (value < best) {
                best = value;
                improved = true;
                continue;
            }
            p[j] = original;
        }

        if (!improved) {
            let maxBetaStep = 0;
            let maxTauStep = 0;
            for (let j = 0; j < 6; j++) {
                steps[j] *= 0.5;
                if (j < 4) maxBetaStep = Math.max(maxBetaStep, steps[j]);
                else maxTauStep = Math.max(maxTauStep, steps[j]);
            }
            if (maxBetaStep < 1e-8 && maxTauStep < 1e-5) break;
        }
    }

    return { params: p, objective: best };
}

/**
 * Fit a real Svensson curve to TIPS prices and compare each bond to it.
 * Price residual = market - model clean (negative: cheap to the curve). Residual in bp is
 * market YTM minus model YTM (positive: cheap to the curve).
 * @param {Date|string} settle
 * @param {Array<{maturity:Date|string, coupon:number, cleanPrice:number}>} bonds
 * @return {{params:number[], objective:number, rows:object[]}}
 */
export function analyzeTipsZero(settle, bonds) {
    const settleDate = normalizeDate(settle);
    if (!bonds || bonds.length === 0) throw new Error("No TIPS supplied");

    const clean = [];
    for (const [i, bond] of bonds.entries()) {
        const maturity = normalizeDate(bond.maturity);
        if (!maturity || !Number.isFinite(maturity.getTime())) {
            throw new Error(`Invalid maturity at input row ${i + 1}: ${bond.maturity}`);
        }
        if (maturity <= settleDate) continue;

        const coupon = Number(bond.coupon);
        const cleanPrice = Number(bond.cleanPrice);
        if (!Number.isFinite(coupon)) throw new Error(`Invalid coupon at input row ${i + 1}: ${bond.coupon}`);
        if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
            throw new Error(`Invalid clean price at input row ${i + 1}: ${bond.cleanPrice}`);
        }
        clean.push({ maturity, coupon, cleanPrice });
    }

    const { params, objective } = fitTipsSvensson(settleDate, clean);

    const rows = clean.map(bond => {
        const modelDirty = tipsZeroModelPrice(settleDate, bond.maturity, bond.coupon, params);
        const modelClean = modelDirty - accruedInterest(settleDate, bond.maturity, bond.coupon);
        const marketYtm = yieldFromPrice(settleDate, bond.maturity, bond.coupon, bond.cleanPrice);
        const modelYtm = yieldFromPrice(settleDate, bond.maturity, bond.coupon, modelClean);
        return {
            maturity: bond.maturity,
            coupon: bond.coupon,
            marketClean: bond.cleanPrice,
            modelClean: roundPrice(modelClean),
            priceResidual: roundPrice(bond.cleanPrice - modelClean),
            marketYtm,
            modelYtm,
            residualBp: (marketYtm - modelYtm) * 10000,
        };
    });

    return { params, objective, rows };
}
