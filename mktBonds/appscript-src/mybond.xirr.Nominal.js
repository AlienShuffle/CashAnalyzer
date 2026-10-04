/**
 * Calculates the nominal treasury bill/note/bond yield to maturity for a cash flow starting at the settlement date 
 * Uses an Google app script (javascript) XIRR implementation.
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 *
 * @param {Date} settle settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleCP settle real Clean Price
 *
 * @return {number} yield
 * @customfunction
 */
function mybondTreasuryReturn(settle, maturity, coupon, settleCP) {

  // to ensure re-use and consistency, use the Graph table function below to produce the XIRR Results
  // just return the calculated rate.
  const result = mybondGraphTreasuryReturn(settle, maturity, coupon, settleCP);
  if (result === null) return null;
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i][0] === 'irr/totals') return result[i][1];
  }
  throw `xirr failed: irr/totals not found: result[0][0]}`
}

/**
 * Returns a table for graphing the nominal treasury bill/note/bond yield to maturity for a cash flow starting at the settlement date 
 * Uses an Google app script (javascript) XIRR implementation model.
 * 1st row is the YTM calculated for this treasury.
 * 2nd row is the XIRR rate, and total coupons and discount.
 * 3rd row contains column header names.
 * 4th row onward is the graphing table. 1st two columns can be provided to xirr for a rate calculation (results provided in 1st row).
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 *
 * @param {Date} settle settlement date (t0)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleCP settle Clean Price
 *
 * @return {[["irr/totals",xirrRate,cumCoupon,cumDiscount],[...header row...],[date,cashflow,cumCoupon,cumDiscount,currCoupon,currDiscount]]} table
 * @customfunction
 */
function mybondGraphTreasuryReturn(settle, maturity, coupon, settleCP) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);
  const daysToMaturity = mydateDaysBetween_(settleDate, maturityDate);

  const schedule = mybondCouponSchedule(settleDate, maturityDate);
  if (schedule.length === 0) return null;

  const accruedInterest = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);
  const settleDirtyPrice = settleCP + accruedInterest;

  const totalDiscount = 100 - settleCP;
  // amortize the discount across all remaining coupons including maturity by days passed.
  const dailyDiscount = totalDiscount / daysToMaturity;
  const N = schedule.length;
  const semiCoupon = 100 * coupon / 2;

  // results stucture. see header row output below.
  const results = [];

  // calculate each coupon cash flow including maturity (0 = purchase).
  let cumCoupon = -accruedInterest;
  let cumDiscount = 0;
  let lastDiscountDate = settleDate;
  for (let i = 0; i < N; i++) {
    const couponDate = schedule[i];

    cumCoupon += semiCoupon;

    const couponDiscount = dailyDiscount * mydateDaysBetween_(lastDiscountDate, couponDate);
    lastDiscountDate = couponDate;
    cumDiscount += couponDiscount;

    results.push([
      couponDate,
      mybondRoundPrice(semiCoupon + (i === N - 1 ? 100 : 0)),
      mybondRoundPrice(cumCoupon),
      mybondRoundPrice(cumDiscount),
      mybondRoundPrice(semiCoupon - (i === 0 ? accruedInterest : 0)),
      mybondRoundPrice(couponDiscount)
    ]);
  }

  // maturity cashflow reported with last coupon entry in loop.
  // prepend the purchase cash flow (no returns)
  results.unshift([
    settleDate,
    mybondRoundPrice(-settleDirtyPrice)
  ]);

  // run XIRR and prepend results to above the graph report row in the cashflow column.
  const cf = results.map(row => row[1]);
  const dates = results.map(row => row[0]);
  const rate = mybondRoundYield(xirr_(cf, dates));

  // prepend a column header row
  results.unshift([
    "date",
    "cashflow",
    "cumCoupon",
    "cumDiscount",
    "currCoupon",
    "currDiscount",
  ]);

  // prepend rates/totals
  results.unshift([
    "irr/totals",
    rate,
    mybondRoundPrice(cumCoupon),
    mybondRoundPrice(cumDiscount)
  ]);
  
  // prepend yield
  results.unshift([
    "YTM/coupon/discount $",
    mybondRoundYield(myYieldFromPrice(settleDate, maturityDate, coupon, settleCP)),
    coupon,
    mybondRoundCPI(100-settleCP),
  ]);

  return results;
}