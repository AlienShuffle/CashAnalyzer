// calcSao.gs
// I placed a wrapper around the code I pulled from the KevinM (aerokam) yield curves
// for TIPS. He likely adapted it from somewhere else too (Claude?).
// a key change is that I allow empty/null entries to be ignored through the entire pipeline and returned empty.

// SAO "O" step — a SMOOTH-CURVE FIT, not Canty's inflation-shock outlier factor.
// See knowledge/2.0_SAO_Adjustment.md and 2.2_SAO_Residual_Analysis.md.
//
// Canty's O_t (Eq 20–21) adjusts for *known, non-seasonal* inflation shocks not yet
// in the CPI (VAT hike, a gasoline move since the last print) — determined analytically
// per event. We do NOT compute that. Our "O" step instead snaps each SA real-yield
// point to a smooth fair-value curve: for a buy-and-hold holder, indifferent to
// liquidity/relative-value, any deviation from a smooth curve that ISN'T explained by
// a value-relevant factor (coupon, index ratio — both empirically immaterial here)
// is noise to be removed. So SAO_i = smoothCurve(maturity_i) for every TIPS.
//
// The smooth curve is Nelson-Siegel-Svensson (the Fed/GSW real-yield-curve standard).
const SAO_NOISE_YRS = 0.1;  // aerokam had 0.5, exclude < this from the FIT (near-maturity SA is price-noise-dominated)
// XXXX - I chose 0.1 to remove any dates before the max REFCPI date, but the best approach
// XXXX - is to simply remove them from the series. There is no inflation prediction
// XXXX - left in the TIPS. It is as fully baked in as a 30 day T-bill.

// The deseasonalization residual that motivates smoothing is a front-end phenomenon that
// amortizes with maturity (see 2.2 §2, extended full-curve analysis in 2.2 §6): beyond
// ~5-6yrs the SA curve is already smooth on its own, so snapping it to NSS there would
// smooth away genuine coupon/relative-value structure instead of seasonal residual.
// So the curve-fit weight fades from 1 (full snap) to 0 (report raw SA) over this band.
const SAO_BLEND_START_YRS = 6.0; // aerokam had 5.0
const SAO_BLEND_END_YRS = 10.0;  // aerokam had 6.0
// XXXX - eased mostly to see if there is any impact, aerokam's dates are probably best match.

/**
 * Taken settlement dates, maturity dates and yields, produce an NSS fitted yield curve.
 * This is a wrapper around the code I pulled from the KevinM (aerokam) yield curves
 * for TIPS. He likely adapted it from somewhere else too (Claude?).
 * 
 * XXXX - consider parameterizing SAO smoothing boundaries. May be useful after forward efforts are settled.
 * 
 * Send the following to the SAO calculation:
 * bonds[] include
 * bonds.settlementDate
 * bonds.maturityDate
 * bonds.saYield
 * bonds.yrs
 * 
 * @param {Date[]} settles settlement dates
 * @param {Date} matures maturity dates
 * @param {number[]} yields seasonally adjusted yields
 * @return {number[]}
 * @customfunction
 */
function getSaoCurve(settles, matures, yields) {

  if (settles.length != matures.length) throw Error(`settles[${settles.length}] and matures[${matures.length}] are different lengths`);
  if (settles.length != yields.length) throw Error(`settles[${settles.length}] and yields[${yields.length}] are different lengths`);

  const bonds = []
  for (let i = 0; i < settles.length; i++) {

    // if one of the key inputs is empty, create holding place value with yrs =  null, the algo will ignore/skip.
    if (
      (settles[i] === '') || (Array.isArray(settles[i]) && settles[i][0] === '') ||
      (matures[i] === '') || (Array.isArray(matures[i]) && matures[i][0] === '') ||
      (yields[i] === '') || (Array.isArray(yields[i]) && yields[i][0] === '')
    ) {
      bonds.push({
        saYield: 0,
        years: null
      })
    } else {
      const settleDate = mydateNormalize_(settles[i]);
      const matureDate = mydateNormalize_(matures[i]);

      const daysToMat = mydateDaysBetween_(settleDate, matureDate);
      const daysInYear = mydateDaysInYearFrom_(settleDate);
      const yrs = daysToMat / ((daysToMat < 365) ? daysInYear : 365.25);

      bonds.push({
        saYield: yields[i],
        years: yrs
      })
    }
  }
  const sao = calculateSAO_(bonds);
  const result = sao.map(n => [n === null ? "" : mybondRoundYield(n)]);
  return result;
}

// This calculates and returns a fitted curve using the NSS algorithm  using provided seasonally adjusted TIPS.
function calculateSAO_(bonds) {
  const n = bonds.length;
  const sao = new Array(n);
  if (n === 0) return sao;

  // this adapted from aerokam as it used different dates of unknown form, I moved the yrs calc into
  // the calling function wrapper as I know the date format more certainly above.
  const yrs = bonds.map(b => b.years);

  // Fit on reliable points only; near-maturity SA yields are price-noise-dominated.
  const fitIdx = [];
  for (let i = 0; i < n; i++) if (yrs[i] >= SAO_NOISE_YRS) fitIdx.push(i);
  const curve = fitNSS_(fitIdx.map(i => yrs[i]), fitIdx.map(i => bonds[i].saYield));

  for (let i = 0; i < n; i++) {
    const b = bonds[i];
    if (yrs[i] === null) {
      sao[i] = null;
    } else {
      const fit = curve ? curve(yrs[i]) : b.saYield;
      const weight = yrs[i] < SAO_NOISE_YRS
        ? 1
        : Math.min(1, Math.max(0, (SAO_BLEND_END_YRS - yrs[i]) / (SAO_BLEND_END_YRS - SAO_BLEND_START_YRS)));
      b._saoFit = fit;
      b._saoWeight = weight;
      b._saoDevBps = (b.saYield - fit) * 10000;   // how far the SA point sat off the smooth curve (rich/cheap)
      b._saoMode = yrs[i] < SAO_NOISE_YRS ? 'noise' : weight >= 1 ? 'smooth' : weight <= 0 ? 'raw' : 'fade';
      sao[i] = fit * weight + b.saYield * (1 - weight);
    }
  }
  return sao;
}

// NSS basis at maturity τ for decay params λ1, λ2: [level, slope, curv1, curv2].
function nssBasis_(tau, l1, l2) {
  const a = tau / l1, b = tau / l2;
  const f1 = a > 1e-6 ? (1 - Math.exp(-a)) / a : 1;
  const fb = b > 1e-6 ? (1 - Math.exp(-b)) / b : 1;
  return [1, f1, f1 - Math.exp(-a), fb - Math.exp(-b)];
}

// OLS for the 4 linear betas (given λ's) via 4×4 normal equations + Gaussian elimination.
function ols4_(X, y) {
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], bv = [0, 0, 0, 0];
  for (let k = 0; k < X.length; k++) {
    const xi = X[k];
    for (let i = 0; i < 4; i++) { bv[i] += xi[i] * y[k]; for (let j = 0; j < 4; j++) A[i][j] += xi[i] * xi[j]; }
  }
  const M = A.map((r, i) => [...r, bv[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  return [M[0][4] / M[0][0], M[1][4] / M[1][1], M[2][4] / M[2][2], M[3][4] / M[3][3]];
}

// Fit NSS: grid-search the two decay params (betas are linear given λ's), keep best SSR.
// Returns an evaluator τ → yield, or null if degenerate.
function fitNSS_(taus, ys) {
  if (taus.length < 4) return null;
  const grid = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15, 20, 30];
  let best = null;
  for (const l1 of grid) for (const l2 of grid) {
    if (l2 <= l1) continue;
    const X = taus.map(t => nssBasis_(t, l1, l2));
    const beta = ols4_(X, ys);
    if (!beta) continue;
    let ssr = 0;
    for (let k = 0; k < taus.length; k++) {
      const xb = nssBasis_(taus[k], l1, l2);
      const yh = xb[0] * beta[0] + xb[1] * beta[1] + xb[2] * beta[2] + xb[3] * beta[3];
      ssr += (ys[k] - yh) ** 2;
    }
    if (!best || ssr < best.ssr) best = { l1, l2, beta, ssr };
  }
  if (!best) return null;
  const fn = tau => {
    const xb = nssBasis_(tau, best.l1, best.l2);
    return xb[0] * best.beta[0] + xb[1] * best.beta[1] + xb[2] * best.beta[2] + xb[3] * best.beta[3];
  };
  fn._params = best;
  return fn;
}
