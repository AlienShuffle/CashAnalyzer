// mybond.Canty.gs

/**
 * Simple Canty Yield
 * See: https://www.risk.net/sites/default/files/import_unmanaged/risk.net/data/risk/pdf/technical/2009/risk_0109_technical_inflation.pdf
 * Implements formula 13, including the adjustment for real accrued interest.
 * Formula 14 omits the rai adjustment and is the more common implementation.
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @param {number} settleFactor Seasonal Adjustment for Settlement date
 * @param {number} matureFactor Seasonal Adjustment for Maturity Date
 *
 * @return {number}
 * @customfunction
 */
function mybondSimpleCanty(settle, maturity, coupon, price, settleFactor, matureFactor) {
  const priceAdjusted = mybondSimpleCantyPrice(settle, maturity, coupon, price, settleFactor, matureFactor);
  return mybondRoundYield_(myYieldFromPrice(settle, maturity, coupon, priceAdjusted));
}

/**
 * Simple Canty Price - the guts of SACP calculation using Canty formula (13)
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @param {number} settleFactor Seasonal Adjustment for Settlement date
 * @param {number} matureFactor Seasonal Adjustment for Maturity Date
 *
 * @return {number}
 * @customfunction
 */
function mybondSimpleCantyPrice(settle, maturity, coupon, price, settleFactor, matureFactor) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  const saRatio = settleFactor / matureFactor;

  const rai = mybondAccruedInterest(settleDate, maturityDate, coupon);
  const raiAdjusted = rai * (1 - saRatio);
  const priceAdjusted = saRatio * price + raiAdjusted;
  return mybondRoundPrice_(priceAdjusted);
}

/**
 * Full Canty Yield - weights seasonal adjustments based upon each coupon's month. 
 * See: https://www.risk.net/sites/default/files/import_unmanaged/risk.net/data/risk/pdf/technical/2009/risk_0109_technical_inflation.pdf
 * Implements Canty formula (17), including the adjustment for real accrued interest shown in formula 13.
 * Formula 14 omits the rai adjustment and is the more common implementation.
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @param {number} settleFactor Seasonal Adjustment for Settlement date
 * @param {number} firstCouponFactor Seasonal Adjustment for 1st coupon (not maturity) date
 * @param {number} matureFactor Seasonal Adjustment for Maturity Date
 *
 * @return {number}
 * @customfunction
 */
function mybondFullCanty(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor) {
  const priceAdjusted = mybondFullCantyPrice(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor);
  return mybondRoundYield_(myYieldFromPrice(settle, maturity, coupon, priceAdjusted));
}

/**
 * Full Canty Price - returns an seasonally adjusted Clean Price using Canty formual (17).
 * 
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} price Real Clean Price
 * @param {number} settleFactor Seasonal Adjustment for Settlement date
 * @param {number} firstCouponFactor Seasonal Adjustment for 1st coupon (not maturity) date
 * @param {number} matureFactor Seasonal Adjustment for Maturity Date
 *
 * @return {number}
 * @customfunction
 */
function mybondFullCantyPrice(settle, maturity, coupon, price, settleFactor, firstCouponFactor, matureFactor) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  const matureMonth = maturityDate.getMonth();
  // not the first one ever, just the one not in the same month as maturity (mature - 6 mos.)
  const firstCouponDate = mybondAddSemiannualPeriods_(maturityDate, -1, maturityDate.getDate());
  const firstCouponMonth = firstCouponDate.getMonth();

  const schedule = mybondCouponSchedule_(settleDate, maturityDate);
  const N = schedule.length;
  if (N === 0) return null;

  const t0 = settleDate;
  const t0year = mydateDaysInYearFrom_(t0);
  const years = schedule.map(d =>
    mydateDaysBetween_(t0, d) / t0year
  );

  // a basline yield for the weighting PV. Use default real YTM for this bond.
  // yld could be defaulted to something like 1.5 or 2% and get nearly the same result in practice.
  const yld = myYieldFromPrice(settleDate, maturityDate, coupon, price);

  let w1 = 0;
  let w2 = 0;
  for (let i = 0; i < N; i++) {

    const discountFactor = Math.pow(1 + yld, -years[i]);
    const couponPV = (coupon / 2) * discountFactor;
    const couponMonth = schedule[i].getMonth();

    if (couponMonth === firstCouponMonth) w1 += couponPV;
    if (couponMonth === matureMonth) w2 += couponPV;

    // add discounted principal at maturity
    if (i === N - 1) w2 += 100 * discountFactor;
  }

  // this needs to follow Full Canty model in formula 17.
  const saRatio = (w1 * (settleFactor / firstCouponFactor) + w2 * (settleFactor / matureFactor)) / (w1 + w2);

  const rai = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);
  const raiAdjusted = rai * (1 - settleFactor / matureFactor); // preferred because the accrued interest is as of settlement.
  const priceAdjusted = saRatio * price + raiAdjusted;
  return mybondRoundPrice_(priceAdjusted);
}