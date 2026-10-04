/**
 * Calculates the bond's Treasury equivalent yield (coupon-equivalent yield) from the clean price of a bond.
 * Note, for zero-coupon bonds of a maturity < 6 mos. this formula calculates the Treasury's preferred formula. 
 * Yields may differ from Excel by up to a few basis points for bonds in their final coupon period (N=1)
 * due to differing settlement-period conventions.
 * Assumes Treasury coupons and calendar(aka Excel 2,1 parameters)
 *
 * @param {Date} settle Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @return {number}
 * @customfunction
 */
function myYieldFromPrice(settle, maturity, coupon, price) {
  return myYieldFromPriceRedemption(settle, maturity, coupon, price);
}

/**
 * Calculates the bond's Treasury equivalent yield (coupon-equivalent yield) from the clean price of a bond.
 * Note, for zero-coupon bonds of a maturity < 6 mos. this formula calculates the Treasury's preferred formula. 
 * Yields may differ from Excel by up to a few basis points for bonds in their final coupon period (N=1)
 * due to differing settlement-period conventions.
 * Assumes Treasury coupons and calendar(aka Excel 2,1 parameters)
 *
 * @param {Date} settle Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @param {number} redemption [default=100] value of bond at redemption, defaults to 100, but can put in nominal price if doing nominal returns.
 * @return {number}
 * @customfunction
 */
function myYieldFromPriceRedemption(settle, maturity, coupon, price, redemption = 100) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  if (!coupon) coupon = 0; // fix case where zero coupons are empty not zero.
  if (!price || price <= 0) return null;
  if (settleDate >= maturityDate) return null;

  const daysToMat = mydateDaysBetween_(settleDate, maturityDate);
  const daysInYear = mydateDaysInYearFrom_(settleDate);
  const yrs = daysToMat / daysInYear;

  // Zero-coupon bills: Treasury's own investment-rate (coupon-equivalent yield)
  // formula, per ofcalc6decbill.pdf. For bills of not more than one half-year to
  // maturity: i = ((100-P)/P) × (y/r), where y = daysInYearFrom(settle) (365 or
  // 366) and r = daysToMat. Bills of more than one half-year to maturity use
  // Treasury's quadratic CEY formula — validated (see knowledge/Bond_Basics.md
  // §Treasury Bill Yield) to match the standard frequency=2 YIELD formula below
  // to within rounding, so no separate quadratic solver is needed here; falling
  // through to the frequency=2 path (zero coupon, one synthetic final cash flow)
  // reproduces it. No coupon schedule exists for the ≤6mo case, so it stays a
  // pure day-count test.

  if (coupon === 0) {

    if (yrs < 0.5) {
      // Basic Investment Rate formula: excel formula from #Cruncher (100/price-1)/yrs
      const value = (redemption / price - 1) / yrs;
      Logger.log(`coupon=0 yrs<0.5 value=${value}`);
      return mybondRoundYield(value);
    }
  }

  const { w, schedule, N } = mybondGetFacts_(settleDate, maturityDate);
  const accrual = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);
  const dirtyPrice = price + accrual;

  function pv(yld) {
    if (yld <= -1.99) return Number.POSITIVE_INFINITY;
    let value = 0;
    for (let i = 0; i < N; i++) {
      const cf = redemption * ((i === N - 1 ? 1 : 0) + coupon / 2);
      // using bond equivalent yields so compounding semi-annual coupons
      const exponent = w + i;
      value += cf / Math.pow(1 + yld / 2, exponent);
    }
    return value;
  }

  function dpv(yld) {
    let deriv = 0;
    for (let i = 0; i < N; i++) {
      const cf = redemption * ((i === N - 1 ? 1 : 0) + coupon / 2);
      // using bond equivalent yields so compounding semi-annual coupons
      const exponent = w + i;
      deriv += -exponent * cf / (2 * Math.pow(1 + yld / 2, exponent + 1));
    }
    return deriv;
  }

  let yld = coupon > 0.005 ? coupon : 0.02;
  for (let i = 0; i < 200; i++) {
    const diff = pv(yld) - dirtyPrice;
    Logger.log(`diff=${diff}`);
    if (Math.abs(diff) < 1e-10) break;
    const deriv = dpv(yld);
    if (Math.abs(deriv) < 1e-15) break;
    yld -= diff / deriv;
  }

  const rounded = mybondRoundYield(yld);
  Logger.log(`final rounded yld=${rounded}`);
  return rounded;
}