// Deterministic Svensson fit: a tau grid with Levenberg-Marquardt on the betas, then a six-parameter
// Levenberg-Marquardt polish of the best grid candidates. Replaces the compute-light Apps Script
// search (still available as fitTipsSvenssonLegacy) that stalls in local minima.

const TAU1_RANGE = [0.1, 15];
const TAU2_RANGE = [0.5, 60];
const MIN_TAU_RATIO = 1.05;

const geometric = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)));

function inBounds(p) {
    const [, , , , tau1, tau2] = p;
    return tau1 >= TAU1_RANGE[0] && tau1 <= TAU1_RANGE[1]
        && tau2 >= TAU2_RANGE[0] && tau2 <= TAU2_RANGE[1]
        && tau2 >= tau1 * MIN_TAU_RATIO;
}

// Weighted price residuals (and, when asked, the beta Jacobian) for prepared bonds.
function evaluate(prepared, p, withJacobian) {
    const [b0, b1, b2, b3, tau1, tau2] = p;
    const n = prepared.length;
    const r = new Float64Array(n);
    const J = withJacobian ? Array.from({ length: n }, () => new Float64Array(4)) : null;
    for (let i = 0; i < n; i++) {
        const bond = prepared[i];
        const sw = Math.sqrt(bond.weight);
        let pv = 0;
        for (let k = 0; k < bond.times.length; k++) {
            const t = bond.times[k];
            const x1 = t / tau1;
            const e1 = Math.exp(-x1);
            const a1 = (1 - e1) / x1;
            const x2 = t / tau2;
            const e2 = Math.exp(-x2);
            const h = (1 - e2) / x2 - e2;
            const df = Math.exp(-(b0 + b1 * a1 + b2 * (a1 - e1) + b3 * h) * t);
            const cfdf = bond.cashFlows[k] * df;
            pv += cfdf;
            if (J) {
                const g = -cfdf * t * sw;
                J[i][0] += g;
                J[i][1] += g * a1;
                J[i][2] += g * (a1 - e1);
                J[i][3] += g * h;
            }
        }
        r[i] = sw * (pv - bond.marketDirty);
    }
    return { r, J };
}

const sumSquares = r => r.reduce((s, v) => s + v * v, 0);

function solve(A, b) {
    const m = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < m; c++) {
        let piv = c;
        for (let i = c + 1; i < m; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
        if (Math.abs(M[piv][c]) < 1e-300) return null;
        [M[c], M[piv]] = [M[piv], M[c]];
        for (let i = c + 1; i < m; i++) {
            const f = M[i][c] / M[c][c];
            for (let j = c; j <= m; j++) M[i][j] -= f * M[c][j];
        }
    }
    const x = new Array(m);
    for (let i = m - 1; i >= 0; i--) {
        let s = M[i][m];
        for (let j = i + 1; j < m; j++) s -= M[i][j] * x[j];
        x[i] = s / M[i][i];
    }
    return x;
}

/**
 * Levenberg-Marquardt over the free parameter indices; tau columns use central differences.
 * @return {{p:number[], sse:number}}
 */
function levenbergMarquardt(prepared, start, free, maxIterations) {
    let p = start.slice();
    let sse = sumSquares(evaluate(prepared, p, false).r);
    let lambda = 1e-3;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const { r, J } = evaluate(prepared, p, true);
        const cols = free.map(j => {
            if (j < 4) return J.map(row => row[j]);
            const h = 1e-5 * p[j];
            const up = p.slice(); up[j] += h;
            const dn = p.slice(); dn[j] -= h;
            const ru = evaluate(prepared, up, false).r;
            const rd = evaluate(prepared, dn, false).r;
            return Array.from(ru, (v, i) => (v - rd[i]) / (2 * h));
        });
        const m = free.length;
        const JtJ = Array.from({ length: m }, (_, a) => Array.from({ length: m }, (_, b) =>
            cols[a].reduce((s, v, i) => s + v * cols[b][i], 0)));
        const grad = cols.map(col => col.reduce((s, v, i) => s + v * r[i], 0));

        let accepted = false;
        for (let attempt = 0; attempt < 12; attempt++) {
            const damped = JtJ.map((row, a) => row.map((v, b) => (a === b ? v + lambda * Math.max(v, 1e-12) : v)));
            const step = solve(damped, grad.map(v => -v));
            if (!step || !step.every(Number.isFinite)) { lambda *= 10; continue; }
            const trial = p.slice();
            free.forEach((j, a) => { trial[j] += step[a]; });
            if (!inBounds(trial)) { lambda *= 10; continue; }
            const trialSse = sumSquares(evaluate(prepared, trial, false).r);
            if (Number.isFinite(trialSse) && trialSse < sse) {
                const converged = sse - trialSse <= 1e-13 * sse;
                p = trial;
                sse = trialSse;
                lambda = Math.max(lambda / 5, 1e-12);
                accepted = true;
                if (converged) return { p, sse };
                break;
            }
            lambda *= 10;
        }
        if (!accepted) break;
    }
    return { p, sse };
}

/**
 * @param {Array<{marketDirty:number,times:number[],cashFlows:number[],weight:number}>} prepared
 * @return {{params:number[], objective:number}} objective is the weighted sum of squared dirty-price errors
 */
export function fitPreparedSvensson(prepared) {
    const candidates = [];
    for (const tau1 of geometric(0.3, 8, 12)) {
        for (const tau2 of geometric(2, 40, 12)) {
            if (tau2 < tau1 * 1.5) continue;
            const fit = levenbergMarquardt(prepared, [0.03, -0.01, 0, 0, tau1, tau2], [0, 1, 2, 3], 40);
            candidates.push(fit);
        }
    }
    candidates.sort((a, b) => a.sse - b.sse);

    let best = null;
    for (const candidate of candidates.slice(0, 8)) {
        const fit = levenbergMarquardt(prepared, candidate.p, [0, 1, 2, 3, 4, 5], 200);
        if (!best || fit.sse < best.sse) best = fit;
    }
    if (!best) throw new Error("Svensson fit failed to converge");
    return { params: best.p, objective: best.sse };
}
