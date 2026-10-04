// SAO ("O") step: snap seasonally adjusted real yields to a smooth Nelson-Siegel-Svensson
// curve. Ported from aerokam.calcSao.gs. This is a smooth-curve fit, not Canty's
// inflation-shock outlier factor; beyond the blend band the raw SA yield is reported.
import { daysBetween, daysInYearFrom, normalizeDate } from "../dates.mjs";
import { roundYield } from "../rounding.mjs";

const SAO_NOISE_YRS = 0.1; // maturities under this are excluded from the fit
const SAO_BLEND_START_YRS = 6.0; // full snap to the curve below this
const SAO_BLEND_END_YRS = 10.0; // raw SA yield above this; linear fade between

// NSS basis at maturity tau for decay params l1, l2: [level, slope, curv1, curv2].
function nssBasis(tau, l1, l2) {
    const a = tau / l1;
    const b = tau / l2;
    const f1 = a > 1e-6 ? (1 - Math.exp(-a)) / a : 1;
    const fb = b > 1e-6 ? (1 - Math.exp(-b)) / b : 1;
    return [1, f1, f1 - Math.exp(-a), fb - Math.exp(-b)];
}

// OLS for the 4 linear betas via normal equations and Gaussian elimination.
function ols4(X, y) {
    const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const bv = [0, 0, 0, 0];
    for (let k = 0; k < X.length; k++) {
        const xi = X[k];
        for (let i = 0; i < 4; i++) {
            bv[i] += xi[i] * y[k];
            for (let j = 0; j < 4; j++) A[i][j] += xi[i] * xi[j];
        }
    }
    const M = A.map((r, i) => [...r, bv[i]]);
    for (let c = 0; c < 4; c++) {
        let p = c;
        for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        if (Math.abs(M[p][c]) < 1e-12) return null;
        [M[c], M[p]] = [M[p], M[c]];
        for (let r = 0; r < 4; r++) {
            if (r === c) continue;
            const f = M[r][c] / M[c][c];
            for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k];
        }
    }
    return [M[0][4] / M[0][0], M[1][4] / M[1][1], M[2][4] / M[2][2], M[3][4] / M[3][3]];
}

// Grid-search the two decay params (betas are linear given the lambdas), keep the best SSR.
// Returns an evaluator tau -> yield, or null if degenerate.
function fitNSS(taus, ys) {
    if (taus.length < 4) return null;
    const grid = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15, 20, 30];
    let best = null;
    for (const l1 of grid) {
        for (const l2 of grid) {
            if (l2 <= l1) continue;
            const beta = ols4(taus.map(t => nssBasis(t, l1, l2)), ys);
            if (!beta) continue;
            let ssr = 0;
            for (let k = 0; k < taus.length; k++) {
                const xb = nssBasis(taus[k], l1, l2);
                const yh = xb[0] * beta[0] + xb[1] * beta[1] + xb[2] * beta[2] + xb[3] * beta[3];
                ssr += (ys[k] - yh) ** 2;
            }
            if (!best || ssr < best.ssr) best = { l1, l2, beta, ssr };
        }
    }
    if (!best) return null;
    return tau => {
        const xb = nssBasis(tau, best.l1, best.l2);
        return xb[0] * best.beta[0] + xb[1] * best.beta[1] + xb[2] * best.beta[2] + xb[3] * best.beta[3];
    };
}

const isBlank = v => v === "" || v === null || v === undefined;

/**
 * Smooth-curve SAO yields for a set of TIPS.
 * @param {Array<Date|string>} settles settlement dates
 * @param {Array<Date|string>} matures maturity dates
 * @param {Array<number>} yields seasonally adjusted real yields (decimal)
 * @return {Array<number|null>} adjusted yields; null where an input was blank
 */
export function getSaoCurve(settles, matures, yields) {
    if (settles.length !== matures.length) {
        throw new Error(`settles[${settles.length}] and matures[${matures.length}] are different lengths`);
    }
    if (settles.length !== yields.length) {
        throw new Error(`settles[${settles.length}] and yields[${yields.length}] are different lengths`);
    }

    const bonds = settles.map((settle, i) => {
        if (isBlank(settle) || isBlank(matures[i]) || isBlank(yields[i])) {
            return { saYield: 0, years: null };
        }
        const settleDate = normalizeDate(settle);
        const days = daysBetween(settleDate, normalizeDate(matures[i]));
        return { saYield: yields[i], years: days / (days < 365 ? daysInYearFrom(settleDate) : 365.25) };
    });

    const fitIdx = [];
    bonds.forEach((b, i) => { if (b.years !== null && b.years >= SAO_NOISE_YRS) fitIdx.push(i); });
    const curve = fitNSS(fitIdx.map(i => bonds[i].years), fitIdx.map(i => bonds[i].saYield));

    return bonds.map(b => {
        if (b.years === null) return null;
        const fit = curve ? curve(b.years) : b.saYield;
        const weight = b.years < SAO_NOISE_YRS
            ? 1
            : Math.min(1, Math.max(0, (SAO_BLEND_END_YRS - b.years) / (SAO_BLEND_END_YRS - SAO_BLEND_START_YRS)));
        return roundYield(fit * weight + b.saYield * (1 - weight));
    });
}
