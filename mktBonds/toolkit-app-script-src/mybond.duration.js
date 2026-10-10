// duration.gs
// portions adapted from aerokam's bond-math.js

/**
 * Returns Macaulay duration in years, or null if inputs are degenerate.
 * Full Macaulay-duration workings: coupon-date walk, day-count fractions, per-period cash
 * flows/PVs. calculateDuration/calculateMDuration are thin wrappers over this — single source
 * for both the final number and any UI that needs to show how it was derived (5.0 §Nested
 * (Level-3) drills, gap/Future 30Y synthetic-duration drill-downs).
 * Returns null if inputs are degenerate (settlement >= maturity, yld <= -2, or no coupon dates).
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} yld reference yield
 * 
 * @return {number}
 * @customfunction
 */
function mybondCalcDuration(settle, maturity, coupon, yld) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  if (settleDate >= maturityDate || yld <= -2) return null;

  const { w, N } = mybondGetFacts_(settleDate, maturityDate);

  const semiCpn = coupon / 2 * 100;
  const r = yld / 2;
  let wSum = 0;
  let pvSum = 0;

  for (let i = 0; i < N; i++) {
    const cf = i === N - 1 ? semiCpn + 100 : semiCpn;
    const t = w + i;
    const pv = cf / Math.pow(1 + r, t);
    wSum += t * pv;
    pvSum += pv;
  }
  const macaulay = wSum / pvSum / 2;
  return mybondRoundTo_(macaulay, 5);
}

/**
 * Returns Modified Macaulay duration in years, or null if inputs are degenerate.
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} yld reference yield
 * 
 * @return {number}
 * @customfunction
 */
function mybondCalcMDuration(settle, maturity, coupon, yield) {
  const mac = mybondCalcDuration(settle, maturity, coupon, yield);
  if (mac === null) return null;
  return mybondRoundTo_(mac / (1 + yield / 2), 5);
}