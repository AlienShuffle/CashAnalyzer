
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
  return mybondRoundPrice_(accrued)
}
