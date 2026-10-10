// pulled from https://github.com/aerokam/Treasuries/blob/main/shared/src/ref-cpi.js
// on 13-SEP-26 @ 8PM EDT.
// changes made:
// - rewrote the core MaturityFactor routine to work in my ecosystem. factor is retrieved elsewhere.
// - now called: applyCredibilityFactor()

// ─── Credibility factor for a projected maturity SA factor ──────────────────
// The maturity-date SA factor of nearly every outstanding TIPS is a
// substitution: the maturity lies beyond the published series, so
// saFactorForDate() reuses the same month/day from the most recent cycle. BLS
// re-estimates seasonal factors every year from a moving 5–11 year window and
// publishes them only one year forward, so that reuse is an extrapolation of
// the current seasonal pattern whose error grows with the horizon to maturity.
// YieldCurves/knowledge/Seasonal_Factor_Drift.md measures the error and
// derives the weight applied here — the credibility factor of actuarial
// credibility theory (Bühlmann's Z at one observation); the constants below
// are emitted by YieldCurves/scripts/sa-drift-analyze.mjs (FRED CPI-U history,
// 1948-2026).

const SEASONAL_AMPLITUDE = 0.002632;   // within-year sd of the interpolated S series, 2015-2019
const SEASONAL_DRIFT_HORIZONS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30];
const SEASONAL_DRIFT_SIGMA = [   // [monthIndex 0=Jan][horizon] = RMS drift of S(month, 15) over h years
  [0.000830, 0.001005, 0.001052, 0.001209, 0.001411, 0.001475, 0.001602, 0.001910, 0.001895, 0.001900],  // Jan
  [0.000875, 0.001056, 0.001202, 0.001501, 0.001578, 0.001536, 0.002035, 0.002353, 0.002641, 0.002902],  // Feb
  [0.000824, 0.001037, 0.001192, 0.001426, 0.001523, 0.001598, 0.002020, 0.002273, 0.002632, 0.002772],  // Mar
  [0.000802, 0.000979, 0.001157, 0.001283, 0.001333, 0.001540, 0.001768, 0.001758, 0.001769, 0.001632],  // Apr
  [0.000891, 0.001057, 0.001116, 0.001443, 0.001364, 0.001598, 0.001784, 0.001793, 0.001773, 0.001825],  // May
  [0.000793, 0.000860, 0.001052, 0.001334, 0.001421, 0.001604, 0.001884, 0.002121, 0.002223, 0.002338],  // Jun
  [0.000837, 0.000988, 0.001153, 0.001313, 0.001553, 0.001750, 0.002215, 0.002399, 0.002595, 0.002781],  // Jul
  [0.000887, 0.001082, 0.001232, 0.001513, 0.001743, 0.001935, 0.002420, 0.002626, 0.002814, 0.002860],  // Aug
  [0.000802, 0.000974, 0.001136, 0.001360, 0.001559, 0.001792, 0.001973, 0.002224, 0.002423, 0.002262],  // Sep
  [0.000680, 0.000834, 0.000921, 0.001039, 0.001190, 0.001412, 0.001558, 0.001762, 0.001848, 0.001718],  // Oct
  [0.000710, 0.000810, 0.000932, 0.001074, 0.001180, 0.001331, 0.001571, 0.001445, 0.001382, 0.001189],  // Nov
  [0.000661, 0.000865, 0.000953, 0.001080, 0.001255, 0.001368, 0.001531, 0.001638, 0.001608, 0.001375],  // Dec
];
// Seasonal Drift Sigma updated by ajg 9/14/26 with data produced apparently on 9/13/16 by aerokam

// RMS drift of the interpolated SA factor for a maturity calendar month (1-12)
// at horizon h years: linear interpolation on the measured grid, flat past its
// ends. The flat low end is deliberate — the reused factor is the most recent
// past occurrence of that month/day, so it is always ~1 year stale however
// close the maturity is, and h < 1 carries the h = 1 drift, not zero.
function seasonalDriftSigma_(month, h) {
  const row = SEASONAL_DRIFT_SIGMA[month - 1];
  const H = SEASONAL_DRIFT_HORIZONS;
  if (h <= H[0]) return row[0];
  if (h >= H[H.length - 1]) return row[row.length - 1];
  for (let i = 0; i < H.length - 1; i++) {
    if (h <= H[i + 1]) return row[i] + (h - H[i]) / (H[i + 1] - H[i]) * (row[i + 1] - row[i]);
  }
  return row[row.length - 1];
}

/**
 * Credibility factor Z(h) = A² / (A² + σ_drift(h)²): the fraction of a reused
 * maturity factor's departure from 1.0 that survives, given a prior centred on
 * 1.0 with variance A² and an observation whose error variance is σ_drift(h)².
 * 1.0 as h → 0. See DATA_DICTIONARY.md#credibility-factor.
 *
 * @param {integer} month month ordinal from 1-12
 * @param {number} h horizon in years for date under test.
 * 
 * @returns {number}
 * @customfunction
 */
function credibilityFactor_(month, h) {
  if (!(h > 0)) return 1;
  const s = seasonalDriftSigma_(month, h);
  const A2 = SEASONAL_AMPLITUDE * SEASONAL_AMPLITUDE;
  return A2 / (A2 + s * s);
}

/**
 * SA factor for a maturity date, scaled toward 1.0 with the horizon from
 * `asOfDate` (the settlement date in the apps). A maturity date inside the
 * published series should return that exact day's value, unscaled.
 * XXXX - This implementation does not ensure unscaled for very short term items.
 * XXXX - currently depends upon the caller to do that filter.
 * Returns null when the month/day never appears in the series.
 *
 * @param {number} factor REFCPI retrieved SA Factor for maturityDate
 * @param {string|date} asOf current date used to reference decay.
 * @param {string|date} maturity maturity date.
 * 
 * @returns {number}
 * @customfunction
 */
function applyCredibilityFactor(factor, asOf, maturity) {
  if (factor == null) return null;

  const asOfDate = mydateNormalize_(asOf);
  const maturityDate = mydateNormalize_(maturity);

  const h = mydateYearsBetween_(asOfDate, maturityDate);
  if (h <= 0) return factor;

  const month = maturityDate.getMonth() + 1;
  return mybondRoundSeasonal_(1 + (factor - 1) * credibilityFactor_(month, h));
}
/*
 * original code from aerokam.
export function maturitySaFactor(rows, maturityDate, asOfDate) {
  const exact = rows.find(r => r['Ref CPI Date'] === maturityDate);
  if (exact) return parseFloat(exact['SA Factor']);
  const base = saFactorForDate(rows, maturityDate);
  if (base == null) return null;
  const month = parseInt(maturityDate.slice(5, 7), 10);
  const h = (Date.parse(maturityDate) - Date.parse(asOfDate)) / (365.2425 * 86400000);
  return 1 + (base - 1) * credibilityFactor(month, h);
}
*/
