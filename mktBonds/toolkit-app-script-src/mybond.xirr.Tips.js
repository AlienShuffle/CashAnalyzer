// mybond.xirr.Tips.gs

/**
 * Calculates the nominal yield of a TIPS to maturity for a cash flow starting at the settlement date 
 * using a trend inflation assumption based upon a
 * known forward date and inflation to the forward date (max REFCPI).
 * Uses an Google app script (javascript) XIRR implementation.
 * This retrieves an unadjusted Trend Inflation rate.
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 *
 * @param {Date} settle settlement date
 * @param {Date} forward fwd (max REFCPI) date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleRealCP settle real Clean Price
 * @param {number} forwardRealCP forward date real Clean Price; can be obtained by mybondCalcForwardCP()
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} settleREFCPI settlement date REFCPI
 * @param {number} forwardREFCPI date REFCPI on forward date
 * @param {number} inflator trend inflation rate (decimal)
 *
 * @return {number} yield
 * @customfunction
 */
function mybondTipsNominalReturnFromTrendInflation(
  settle, forward, maturity, coupon, settleRealCP, forwardRealCP, datedREFCPI, settleREFCPI, forwardREFCPI, inflator
) {
  return mybondTipsNominalReturn(
    settle, forward, maturity, coupon, settleRealCP, forwardRealCP, datedREFCPI, settleREFCPI, forwardREFCPI, inflator, false
  );
}

/**
 * Calculates the nominal yield of a TIPS to maturity for a cash flow starting at the settlement date 
 * using a trend inflation assumption based upon a
 * known forward date and inflation to the forward date (max REFCPI).
 * Uses an Google app script (javascript) XIRR implementation
 * This retrieves a Seasonally Adjusted Trend Inflation rate if seasonal is set to true.
 * 
 * Seasonal Factors are applied to all cash flows that occur AFTER the forward date using the factor for the date
 * of the cashflow. the initial purchase and any coupons and inflation adjustments before the forward date are not
 * adjusted. All inflation and coupons AFTER forward date are adjusted including redemption.
 * 
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 *
 * @param {Date} settle settlement date (t0)
 * @param {Date} forward fwd (max REFCPI) date (t1)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleRealCP settle real Clean Price (t0)
 * @param {number} forwardRealCP forward date (t1) real Clean Price; can be obtained by mybondCalcForwardCP()
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} settleREFCPI settlement date REFCPI
 * @param {number} forwardREFCPI date REFCPI on forward date
 * @param {number} inflator trend inflation rate (decimal)
 * @param {boolean} seasonal [default = false] include seasonal adjustments if true, otherwise straight trend inflation. 
 *
 * @return {number} yield
 * @customfunction
 */
function mybondTipsNominalReturn(
  settle, forward, maturity,
  coupon,
  settleRealCP, forwardRealCP,
  datedREFCPI, settleREFCPI, forwardREFCPI,
  inflator,
  seasonal = false,
  
) {

  // to ensure re-use and consistency, use the Graph table function below to produce the XIRR Results
  // just return the calculated rate.
  const result = mybondGraphTipsNominalReturn(
    settle, forward, maturity,
    coupon,
    settleRealCP, forwardRealCP,
    datedREFCPI, settleREFCPI, forwardREFCPI,
    inflator,
    seasonal,
    
  );
  if (result === null) return null;
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i][0] === 'irr/totals') return result[i][1];
  }
  throw `xirr failed: irr/totals not found: result[0][0]}`
}

/**
 * Returns a table for graphing the nominal TIPS yield to maturity for a cash flow starting at the settlement date 
 * using a trend inflation assumption based upon a
 * known forward date and inflation to the forward date (max REFCPI).
 * This retrieves a Seasonally Adjusted Trend Inflation rate if seasonal is set to true.
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 * Uses an Google app script (javascript) XIRR implementation model.
 * 1st two columns can be provided to xirr for a rate calculation.
 *
 * @param {Date} settle settlement date (t0)
 * @param {Date} forward fwd (max REFCPI) date (t1)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleRealCP settle real Clean Price (t0)
 * @param {number} forwardRealCP forward date (t1) real Clean Price; can be obtained by mybondCalcForwardCP()
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} settleREFCPI settlement date REFCPI (t0)
 * @param {number} forwardREFCPI date REFCPI on forward date (t1)
 * @param {number} inflator trend inflation rate (decimal) (from t1 to t2)
 * @param {boolean} seasonal [default = false] include seasonal adjustments if true, otherwise straight trend inflation. 
 *
 * @return {[[date,cashflow,cumCouponReturn,cumDiscountReturn,currCoupon,currDiscountReturn]]} yield
 * @customfunction
 */
function mybondGraphTipsNominalReturn(
  settle, forward, maturity,
  coupon,
  settleRealCP,
  forwardRealCP,
  datedREFCPI, settleREFCPI, forwardREFCPI,
  inflator,
  seasonal = false,
  
) {
  // XXXX - factors needed: settle, maturity, forward, 1st coupon date (maturity - 6 mos.)
  // XXXX - the pre-fwd Coupon creates the need to look up REFCPI directly....

  const settleDate = mydateNormalize_(settle);
  const forwardDate = mydateNormalize_(forward);
  const maturityDate = mydateNormalize_(maturity);
  // flag if maturity is before forward date - special case.
  const matureBeforeForward = mydateLessThan_(maturityDate, forwardDate) || forwardRealCP === null || forwardRealCP === '';

  const daysToForward = mydateDaysBetween_(settleDate, forwardDate);   // t0 to t1
  const daysToMaturity = mydateDaysBetween_(settleDate, maturityDate); // t0 to t2

  const settleIR = settleREFCPI / datedREFCPI;
  //const forwardIR = forwardREFCPI / datedREFCPI;

  // XXXX - consider parameterizing these Factor values to the function.
  const maturitySaFactor = seasonal ? tipsGetFactor(maturityDate) : 1;
  const settleSaFactor = seasonal ? tipsGetFactor(settleDate) : 1;
  const settleSaRatio = seasonal ? settleSaFactor / maturitySaFactor : 1;
  const forwardSaFactor = seasonal ? tipsGetFactor(forwardDate) : 1;
  const forwardSaRatio = seasonal ? forwardSaFactor / maturitySaFactor : 1;

  const schedule = mybondCouponSchedule_(settleDate, maturityDate);
  if (schedule.length === 0) return null;

  // settle accrued interest and dirty price.
  const settleAccruedRealInterest = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);
  const settleAccruedNominalInterest = mybondRoundPrice_(settleIR * settleAccruedRealInterest);
  const settleNominalDirtyPrice = settleIR * (settleRealCP + settleAccruedRealInterest);

  // forward accrued interest and dirty price.
  //const forwardAccruedRealInterest = matureBeforeForward ? 0 : mybondAccruedInterest(forwardDate, maturityDate, coupon);
  //const forwardAccruedNominalInterest = matureBeforeForward ? 0 : forwardIR * forwardAccruedRealInterest;
  //const forwardNominalDirtyPrice = matureBeforeForward ? 0 : forwardIR * (settleRealCP + forwardAccruedRealInterest);

  // amortize the discount across all remaining coupons including maturity by days passed.
  const totalRealDiscount = 100 - settleRealCP;
  const dailyRealDiscount = totalRealDiscount / daysToMaturity;

  // total known inflation and discount
  const totalKnownInflation = 100 * (forwardREFCPI - settleREFCPI) / datedREFCPI;
  //const dailyKnownInflation = totalKnownInflation / daysToForward;

  // total known discount
  const totalKnownRealDiscount = matureBeforeForward ? 0 : forwardRealCP - settleRealCP;
  const dailyKnownRealDiscount = totalKnownRealDiscount / daysToForward;

  const N = schedule.length;
  const semiRealCoupon = 100 * coupon / 2;
  const results = [];

  // calculate each coupon cash flow including maturity
  // Also calculate cumulative and current coupon, discount, SA factor, and inflation metrics.
  let cumTrendInflation = 0;
  let cumKnownInflation = 0;
  let cumFutureInflation = 0;
  let lastCouponREFCPI = settleREFCPI;
  let cumCoupon = -settleAccruedNominalInterest;
  let cumDiscount = 0;
  let cumKnownDiscount = 0;
  //let cumFutureDiscount = 0;
  let lastDiscountDate = settleDate;
  let cumSA = 0;
  for (let i = 0; i < N; i++) {
    const couponDate = schedule[i];

    // let's tee up the coupon, make sure it is valid and where it stand related to the forward date.
    const fwdYrs = mydateDaysBetween_(forwardDate, couponDate) / 365;
    const preFwdCoupon = mydateLessThan_(couponDate, forwardDate);
    if (fwdYrs > 0 && preFwdCoupon) throw `fwdYrs>0 (${fwdYrs}) and preFwdCoupon is true.`
    if (matureBeforeForward && !preFwdCoupon) throw `matureBeforeForward is true and preFwdCoupon is false!`

    // ---- begin cash flow calculations ----
    // calculate the real or projected coupon REFCPI
    const couponREFCPI = preFwdCoupon
      ? tipsGetRefCpi(couponDate)
      : forwardREFCPI * Math.pow(1 + inflator, fwdYrs);

    const couponIR = couponREFCPI / datedREFCPI;
    //  coupon related seasonal adjustment.
    // see formula (3) in Canty, we only apply the cash-flow factor when creating a cash flow calculation.
    const couponSaFactor = seasonal ? tipsGetFactor(couponDate) : 1;
    // calculate cash flow for 2nd column, includes seasonal adjustments in redemption and coupon (always the full pmt).
    const flow = (preFwdCoupon ? 1 : couponSaFactor) * couponIR * (semiRealCoupon + (i === N - 1 ? 100 : 0));

    // ---- end cash flow calculations ----

    // ---- begin analysis -----
    // from here on, the calculations are just here to build the "graph" table for analysis/illustration.

    const currTrendInflation = 100 * (couponREFCPI - lastCouponREFCPI) / datedREFCPI;
    cumTrendInflation += currTrendInflation;
    lastCouponREFCPI = couponREFCPI;

    const currKnownInflation = preFwdCoupon
      ? currTrendInflation
      : totalKnownInflation - cumKnownInflation;
    cumKnownInflation += currKnownInflation;

    const currFutureInflation = preFwdCoupon
      ? 0
      : currTrendInflation - currKnownInflation;
    cumFutureInflation += currFutureInflation;

    const currCoupon = couponIR * semiRealCoupon;
    cumCoupon += currCoupon;

    const currDiscount = couponIR * dailyRealDiscount * mydateDaysBetween_(lastDiscountDate, couponDate);
    cumDiscount += currDiscount;

    const currKnownDiscount = couponIR * (preFwdCoupon)
      ? dailyKnownRealDiscount * mydateDaysBetween_(lastDiscountDate, couponDate)
      : totalKnownRealDiscount - cumKnownDiscount;
    cumKnownDiscount += currKnownDiscount;
    lastDiscountDate = couponDate;

    // Only including returns AFTER forward date.
    // Note, that the reports/metrics are all unadjusted by column, but the currSA column includes a 
    // total of all the adjustments made to post-forward coupons, future discount, and future inflation.
    const currTotalReturnSA = currFutureInflation + (preFwdCoupon ? 0 : currCoupon + currDiscount - currKnownDiscount);

    // calculate the net impact on the return for this coupon.
    const currSA = (couponSaFactor * currTotalReturnSA) - currTotalReturnSA;
    cumSA += currSA;

    // ----- end analysis code -----

    // enter coupon table entry.
    results.push([
      couponDate,
      mybondRoundPrice_(flow),
      mybondRoundPrice_(cumKnownInflation),
      mybondRoundPrice_(cumFutureInflation),
      mybondRoundPrice_(cumCoupon),
      mybondRoundPrice_(cumDiscount),
      mybondRoundPrice_(cumSA),
      mybondRoundPrice_(currKnownInflation),
      mybondRoundPrice_(currFutureInflation),
      mybondRoundPrice_(currCoupon),
      mybondRoundPrice_(currDiscount),
      mybondRoundPrice_(currSA),
      //mybondRoundPrice(currTrendInflation),
      //mybondRoundREFCPI(couponIR),
      //mybondRoundSeasonal(couponSaFactor),
      //mybondRoundPrice(currTotalReturnSA),
    ]);
  }

  // maturity cashflow reported with last coupon entry in coupon loop.
  // Attribute purchased accrued interest at settlement, not against the first coupon.
  results.unshift([
    settleDate,
    mybondRoundPrice_(-settleNominalDirtyPrice),
    ,
    ,
    -settleAccruedNominalInterest,
    ,
    ,
    ,
    ,
    -settleAccruedNominalInterest,
  ]);

  // run XIRR to get a rate.
  const cf = results.map(row => row[1]);
  const dates = results.map(row => row[0]);
  const rate = mybondRoundYield_(xirr_(cf, dates));

  // header row
  results.unshift([
    "date",
    "cashflow",
    "cumKnownInflation",
    "cumFutureInflation",
    "cumCoupon",
    "cumDiscount",
    "cumSA",
    "currKnownInflation",
    "currFutureInflation",
    "currCoupon",
    "currDiscount",
    "currSA",
    //"currTrendInflation",
    //"couponIR",
    //"couponSaFactor",
    //"currTotalReturnSA",
  ]);

  // prepend XIRR rate and totals for easy access.
  results.unshift([
    "irr/totals",
    rate,
    mybondRoundPrice_(cumKnownInflation),
    mybondRoundPrice_(cumFutureInflation),
    mybondRoundPrice_(cumCoupon),
    mybondRoundPrice_(cumDiscount),
    mybondRoundPrice_(cumSA),
    ,
    ,
    ,
    ,
    ,
    //mybondRoundPrice(cumTrendInflation)
  ]);

  results.unshift([
    "forward SA YTM",
    matureBeforeForward ? 'maturity < forward' : mybondRoundYield_(myYieldFromPrice(forwardDate, maturityDate, coupon, forwardRealCP * forwardSaRatio)),
    ,
    ,
    ,
    ,
    mybondRoundSeasonal_(forwardSaRatio),
  ]);

  results.unshift([
    "settle SA YTM",
    mybondRoundYield_(myYieldFromPrice(settleDate, maturityDate, coupon, settleRealCP * settleSaRatio)),
    ,
    ,
    ,
    ,
    mybondRoundSeasonal_(settleSaRatio),
  ]);

  results.unshift([
    "settle YTM",
    mybondRoundYield_(myYieldFromPrice(settleDate, maturityDate, coupon, settleRealCP)),
    ,
    ,
    coupon,
    mybondRoundPrice_(100 - settleRealCP),
    ,
    ,
    ,
    ,
  ]);

  return results;
}