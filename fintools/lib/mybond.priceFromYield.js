// priceFromYield.gs
// verified against aerokam

/**
 * Calculates the PV of the cash flows for a bond.
 * Assumes Treasury coupons and calendar(aka Excel price(...100,2,1) parameters)
 *
 * @param {Date} settlement Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} yld annual yield (decimal)
 * @return {number}
 * @customfunction
 */
function myPriceFromYield(settle, maturity, coupon, yld) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  if (yld === null || yld === undefined) return null;
  if (mydateLessThan_(maturityDate, settleDate)) return null;

  const { w, N, schedule } = mybondGetFacts_(settleDate, maturityDate);
  const accrued = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);

  let pv = 0;
  for (let i = 0; i < N; i++) {
    const cf = 100 * ((i === N - 1 ? 1 : 0) + coupon / 2);
    // using bond equivalent yields so compounding semi-annual coupons
    const exponent = w + i;
    pv += cf / Math.pow(1 + yld / 2, exponent);
  }
  return mybondRoundPrice_(pv - accrued); // Return clean price
}