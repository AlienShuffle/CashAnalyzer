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
  return mybondRoundPrice(pv - accrued); // Return clean price
}

/**
 * Calculates the seasonally adjusted PV of the cash flows for a TIPS bond.
 * Assumes Treasury coupons and calendar(aka Excel price(...100,2,1) parameters)
 *
 * uses tipsGetFactor() internally.
 * 
 * XXXX - incomplete!
 * XXX - This needs and inflator as well as a real yield to make it work.
 * XXXX - will need a dated date REFCPI and settlement REFCPI as well.
 * 
 * @param {Date} settlement Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} yld annual yield (decimal)
 * @return {number}
 * @customfunction
 */
function mySaPriceFromYield(settle, maturity, coupon, yld) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);


  if (yld === null || yld === undefined) return null;
  if (mydateLessThan_(maturityDate, settleDate)) return null;

  const { w, N, schedule } = mybondGetFacts_(settleDate, maturityDate);
  const accrued = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);

  let pv = 0;
  for (let i = 0; i < N; i++) {
    const cfFactor = tipsGetFactor(schedule[i]);
    const inflation = 1; // this needs to work like the xirr inflators.
    const cf = cfFactor * 100 * ((i === N - 1 ? 1 : 0) + coupon / 2);
    // using bond equivalent yields so compounding semi-annual coupons
    const exponent = w + i;
    pv += cf / Math.pow(1 + yld / 2, exponent);
  }
  return mybondRoundPrice(pv - accrued); // Return clean price
}