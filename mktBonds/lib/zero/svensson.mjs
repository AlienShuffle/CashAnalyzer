// Svensson real zero-coupon curve fitted to TIPS clean prices, plus per-bond analysis against
// the fit. Ported from mybond.zero-coupon.gs. The Sheets wrappers (range flattening, 2D output
// table) became plain object inputs and outputs.
import { daysBetween, normalizeDate } from "../dates.mjs";
import { accruedInterest, couponSchedule } from "../coupons.mjs";
import { macaulayDuration } from "../duration.mjs";
import { roundPrice } from "../rounding.mjs";
import { yieldFromPrice } from "../yield.mjs";
import { fitPreparedSvensson } from "./svenssonFit.mjs";

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

/**
 * Yield of a nominal bond with the given coupon and maturity priced off a Svensson zero curve.
 * @return {number|null} null when the maturity is not after the curve date
 */
export function nominalZeroYtm(settle, maturity, coupon, params) {
    const settleDate = normalizeDate(settle);
    const maturityDate = normalizeDate(maturity);
    const dirty = tipsZeroModelPrice(settleDate, maturityDate, coupon, params);
    if (dirty === null) return null;
    return yieldFromPrice(settleDate, maturityDate, coupon, dirty - accruedInterest(settleDate, maturityDate, coupon));
}

/** Model dirty minus market dirty price for one bond ({maturity, coupon, cleanPrice}). */
export function tipsZeroResidual(settle, bond, params) {
    const marketDirty = bond.cleanPrice + accruedInterest(settle, bond.maturity, bond.coupon);
    return tipsZeroModelPrice(settle, bond.maturity, bond.coupon, params) - marketDirty;
}

function prepareBonds(settleDate, bonds) {
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
    return prepared;
}

/**
 * Fit a Svensson curve to TIPS dirty prices with inverse-duration weights (GSW style) using a
 * deterministic tau grid with Levenberg-Marquardt, then a six-parameter polish of the best candidates.
 * @param {Date|string} settle
 * @param {Array<{maturity:Date|string, coupon:number, cleanPrice:number}>} bonds at least 6 usable
 * @return {{params:number[], objective:number}}
 */
export function fitTipsSvensson(settle, bonds) {
    const settleDate = normalizeDate(settle);
    if (!Array.isArray(bonds) || bonds.length < 6) {
        throw new Error(`Svensson fit requires at least 6 bonds; found ${bonds?.length ?? 0}`);
    }
    const prepared = prepareBonds(settleDate, bonds);
    if (prepared.length < 6) {
        throw new Error(`Insufficient usable bonds for Svensson fit: ${prepared.length}`);
    }
    return fitPreparedSvensson(prepared);
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
