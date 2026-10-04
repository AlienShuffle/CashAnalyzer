// Credibility weighting for projected maturity seasonal factors.
// Ported from aerokam.credibility.gs (from aerokam/Treasuries shared/src/ref-cpi.js).
//
// The maturity-date factor of most TIPS is a projection: the same month/day from the most
// recent published cycle. BLS re-estimates factors every year, so that reuse is an
// extrapolation whose error grows with the horizon. The factor's departure from 1.0 is
// scaled by Z(h) = A^2 / (A^2 + drift(h)^2), the credibility factor.
import { normalizeDate, yearsBetween } from "../dates.mjs";
import { roundSeasonal } from "../rounding.mjs";

const SEASONAL_AMPLITUDE = 0.002632;
const SEASONAL_DRIFT_HORIZONS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30];
// [month 1..12][horizon]: RMS drift of the seasonal factor over h years
const SEASONAL_DRIFT_SIGMA = [
    [0.000830, 0.001005, 0.001052, 0.001209, 0.001411, 0.001475, 0.001602, 0.001910, 0.001895, 0.001900],
    [0.000875, 0.001056, 0.001202, 0.001501, 0.001578, 0.001536, 0.002035, 0.002353, 0.002641, 0.002902],
    [0.000824, 0.001037, 0.001192, 0.001426, 0.001523, 0.001598, 0.002020, 0.002273, 0.002632, 0.002772],
    [0.000802, 0.000979, 0.001157, 0.001283, 0.001333, 0.001540, 0.001768, 0.001758, 0.001769, 0.001632],
    [0.000891, 0.001057, 0.001116, 0.001443, 0.001364, 0.001598, 0.001784, 0.001793, 0.001773, 0.001825],
    [0.000793, 0.000860, 0.001052, 0.001334, 0.001421, 0.001604, 0.001884, 0.002121, 0.002223, 0.002338],
    [0.000837, 0.000988, 0.001153, 0.001313, 0.001553, 0.001750, 0.002215, 0.002399, 0.002595, 0.002781],
    [0.000887, 0.001082, 0.001232, 0.001513, 0.001743, 0.001935, 0.002420, 0.002626, 0.002814, 0.002860],
    [0.000802, 0.000974, 0.001136, 0.001360, 0.001559, 0.001792, 0.001973, 0.002224, 0.002423, 0.002262],
    [0.000680, 0.000834, 0.000921, 0.001039, 0.001190, 0.001412, 0.001558, 0.001762, 0.001848, 0.001718],
    [0.000710, 0.000810, 0.000932, 0.001074, 0.001180, 0.001331, 0.001571, 0.001445, 0.001382, 0.001189],
    [0.000661, 0.000865, 0.000953, 0.001080, 0.001255, 0.001368, 0.001531, 0.001638, 0.001608, 0.001375],
];

// Linear interpolation on the measured grid, flat past its ends. The flat low end is
// deliberate: the reused factor is always ~1 year stale, so h < 1 carries the h = 1 drift.
function seasonalDriftSigma(month, h) {
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
 * Credibility factor Z(h): 1.0 as h -> 0, shrinking with the horizon.
 * @param {number} month calendar month 1-12
 * @param {number} h horizon in years
 * @return {number}
 */
export function credibilityFactor(month, h) {
    if (!(h > 0)) return 1;
    const sigma = seasonalDriftSigma(month, h);
    const a2 = SEASONAL_AMPLITUDE * SEASONAL_AMPLITUDE;
    return a2 / (a2 + sigma * sigma);
}

/**
 * Scale a maturity-date seasonal factor toward 1.0 by the horizon from asOf. The caller
 * should skip this for maturities inside the published series (their exact factor is known).
 * @param {number|null} factor seasonal factor for the maturity date
 * @param {Date|string} asOf settlement date
 * @param {Date|string} maturity maturity date
 * @return {number|null}
 */
export function applyCredibilityFactor(factor, asOf, maturity) {
    if (factor == null) return null;
    const maturityDate = normalizeDate(maturity);
    const h = yearsBetween(normalizeDate(asOf), maturityDate);
    if (h <= 0) return factor;
    return roundSeasonal(1 + (factor - 1) * credibilityFactor(maturityDate.getMonth() + 1, h));
}
