// mybond.utils.gs
// largely adapted with significant refactoring from aerokam.

/**
 * calculates key facts about a bond at settlement date. Commonly used parameters.
 *   DSC = days to next coupon
 *   E = days in coupon period
 *   A = days accrued (days since last coupon)
 *   w = DSC / E is fraction remaining of coupon period
 *   lastCoupon = date of last coupon
 *   nextCoupon = date of next coupon
 *   schedule = coupon schedule - returns schedule passed to function, or the one created if it was missing.
 *   N = number of coupons (including maturity) left.
 *
 * @param {Date} settle Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {Date[]} schedule optional coupon schedule
 * @return { w, lastCoupon, nextCoupon, E, DSC, A, sched, N }
 */
function mybondGetFacts_(settle, maturity, schedule = []) {
  const sched = (Array.isArray(schedule) && schedule.length > 0) ?
    schedule :
    mybondCouponSchedule(settle, maturity);

  if (sched.length === 0)
    throw (
      `bad coupon list for ${settle}=>${maturity}`
    );

  const N = sched.length;
  const nextCoupon = sched[0];
  const lastCoupon = mybondLastCoupon(settle, maturity, sched);
  const E = mydateDaysBetween_(lastCoupon, nextCoupon);
  const A = mydateDaysBetween_(lastCoupon, settle);
  const DSC = mydateDaysBetween_(settle, nextCoupon);
  if (Math.abs((A + DSC) - E) > 1e-9) {
    Logger.log(`Warning: A + DSC = ${A + DSC}, E = ${E}`);
  }
  const w = DSC / E;

  if (w < 0 || w > 1) throw new Error(`Invalid coupon fraction w=${w}`);

  return { w, lastCoupon, nextCoupon, E, DSC, A, schedule: sched, N };
}

/**
 * return the last coupon before settlement.
 * 
 * @param {Date} settle date.
 * @param {Date} maturity maturity date.
 * @param {Date[]} schedule optional coupon schedule
 * @return {Date}
 */
function mybondLastCoupon(settle, maturity, schedule = []) {
  const sched = (Array.isArray(schedule) && schedule.length > 0) ?
    schedule :
    mybondCouponSchedule(settle, maturity);

  if (sched.length === 0)
    throw (
      `bad coupon list for ${settle}=>${maturity}`
    );
  const maturityDate = mydateNormalize_(maturity);
  return mybondAddSemiannualPeriods_(sched[0], -1, maturityDate.getDate());
}

/**
 * Return the next coupon after settlement. Really only use in cases where you aren't needing
 * a full Coupon Schedule anywhere else.
 * 
 * @param {Date} settle
 * @param {Date} maturity
 * @param {Date[]} schedule optional coupon schedule
 * @return {number}
 */
function mybondNextCoupon(settle, maturity, schedule = []) {
  const sched = (Array.isArray(schedule) && schedule.length > 0) ?
    schedule :
    mybondCouponSchedule(settle, maturity);

  if (sched.length === 0)
    throw (
      `bad coupon list for ${settle}=>${maturity}`
    );
  return sched[0];
}

/**
 * Accrued interest (actual/actual day count)
 * Spec: 1.0 Bond Basics §Accrued Interest, 4.0 Computation Modules §accruedInterest
 * Prorates the current coupon period by days elapsed since the last coupon date.
 * Returns accrued interest per $100 par (nominal — no index ratio applied), plus
 * the day-count components (A = days since last coupon, E = days in period).
 * 
 * @param {Date} settle
 * @param {Date} maturity
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {Date[]} schedule optional coupon schedule
 * @return {number}
 * @customfunction
 */
function mybondAccruedInterest(settle, maturity, coupon, schedule = []) {
  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  const { A, E } = mybondGetFacts_(settleDate, maturityDate, schedule);
  const accrued = 100 * (coupon / 2) * (A / E);
  return mybondRoundPrice(accrued)
}

/**
 * Semi-annual date arithmetic (end-of-month safe)
 * addSemiannualPeriods(date, n, matureDay)
 * Moves date by n*6 months without overflow (e.g. Mar 31 + 6 → Sep 30, not Oct 1).
 * 
 * @param coupon current coupon date
 * @param n number of parameters to add onto the date.
 * @param maturityDayOfMonth is the maturity day-of-month used for coupon dates.
 */
function mybondAddSemiannualPeriods_(coupon, n, maturityDayOfMonth) {
  const newDate = new Date(mydateNormalize_(coupon));
  newDate.setDate(1); // pin to 1st to prevent month overflow during setMonth
  newDate.setMonth(newDate.getMonth() + n * 6);
  const lastDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
  newDate.setDate(Math.min(maturityDayOfMonth, lastDay));
  return newDate;
}

/**
 * Returns a schedule of all coupon dates from `settle` (inclusive) through `maturity` (inclusive) — the final
 * entry is also the principal repayment date. Spec: 5.0 §Cash Flow Calendar.
 *
 * @param {Date} settle
 * @param {Date} maturity
 * @return {Date[]}
 */
function mybondCouponSchedule(settle, maturity) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  const schedule = [];
  // start with maturity.
  schedule.unshift(maturityDate);

  // Treasury coupon schedule is defined by maturity month/day
  const maturityDayOfMonth = maturityDate.getDate();

  // Start from maturity and work backwards in 6 month steps
  let d = new Date(maturityDate);
  while (true) {

    d = mybondAddSemiannualPeriods_(d, -1, maturityDayOfMonth);
    if (mydateLessThan_(d, settleDate)) break;
    schedule.unshift(new Date(d));
  }
  return schedule;
}

/**
 * given a zero rate continous rate convert to ao semi-annual coupon bond equivalent yield (BEY)
 * @param {number} z continous rate
 * @returns {number} bey
 * @customfunction
 */
function mybondContinuousToBEY_(z) {
  return 2 * (
    Math.exp(z / 2) - 1
  );
}

/**
 * Return the parameter value as a number rounded to a fixed number of decimal places
 * and potentially truncated to a different number of places before rounding.
 * 
 * Note,this does not round in positions left of the decimal.
 * 
 * @param {number} value number to round.
 * @param {number} roundDp [5] number of decimal places to round to.
 * @param {number} truncDp [-1] number of decimal places to truncate before rounding. -1 avoids pre-truncation.
 * @return {string} result
 */
function mybondRoundTo(value, roundDp = 5, truncDp = -1) {
  if (value === null) return value;

  // just return it if I want to see unrounded values while testing.
  //if (true) return value;

  const nudge = v => v === 0 ? v : v + Math.sign(v) * Math.max(1e-9, Math.abs(v) * 1e-12);
  const truncFactor = 10 ** truncDp;
  const truncated = (truncDp === -1) ? value : (Math.trunc(nudge(value * truncFactor)) / truncFactor);
  const roundFactor = 10 ** roundDp;
  return Math.round(nudge(truncated * roundFactor)) / roundFactor;

  /* my previous attempt, now replaced with one from aerokam.
    const truncValue = (truncDp === -1) ? x : Math.trunc(x,truncDp);
    const factor = Math.pow(10, roundDp);
    const rounded = (Math.round((truncValue + Number.EPSILON) * factor) / factor);
    return rounded;
  */
}

function mybondRoundYield(value) { return mybondRoundTo(value, 5, 6) }    // 3 places, but we used decimal, not points representation, so 5.
function mybondRoundREFCPI(value) { return mybondRoundTo(value, 5, 6) }   // weird but true, trunc to 6, then round to 5!
// above correct for Index Ratios as well.
function mybondRoundPrice(value) { return mybondRoundTo(value, 6) }       // just round to 6
function mybondRoundCPI(value) { return mybondRoundTo(value, 3) }         // just round to 3
function mybondRoundSeasonal(value) { return mybondRoundTo(value, 5, 6) } // 5 should be since we divide by 100, or just round to 3


/**
 * ============================================================================
 * SUMMARY OF TIPS DECIMAL PRECISIONS & ROUNDING RULES
 * Source: U.S. Treasury (31 CFR Part 356) & Bureau of Labor Statistics (BLS)
 * ============================================================================
 * 
 * | Data Element             | Governing Body | Rounding/Reporting Rule             | Example Format |
 * | :----------------------- | :------------- | :---------------------------------- | :------------- |
 * | Real Yield Bidding       | U.S. Treasury  | Strict 3 decimal places             | 2.375%         |
 * | Reference CPI            | U.S. Treasury  | Truncated to 6, rounded to 5 dec.   | 333.96974      |
 * | Index Ratio              | U.S. Treasury  | Truncated to 6, rounded to 5 dec.   | 1.07745        |
 * | Clean Price (per $100)   | U.S. Treasury  | Normal rounding to 6 decimal places | 99.811030      |
 * | Published CPI-U Index    | BLS            | Published to 3 decimal places       | 324.935        |
 * | CPI Seasonal Factors*    | BLS            | Updated annually to 3 dec. (Base 1) | 0.998 or 1.002 |
 * 
 * Note: TIPS ignore seasonal adjustments for principal indexing, relying strictly
 * on the Non-Seasonally Adjusted CPI-U. 
 *
 * * BLS CPI seasonal factors are published as multi-decimal ratios centered around 1.0, 
 *   rather than a baseline of 100.
 */