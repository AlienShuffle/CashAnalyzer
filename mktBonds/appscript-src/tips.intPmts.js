/**
 * XXXX - this is not implemented. Just a shell copies from the graph functions.
 * 
 * Given details of a current TIPS including the date the security was purchased, return the
 * total nominal interest coupon payments received for this TIPS during its time of ownership.
 *
 * @param {Date} purchased date purchased
 * @param {Date} settle settlement date (t0)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} settleRealCP settle real Clean Price (t0)
 * @param {number} forwardRealCP forward date (t1) real Clean Price; can be obtained by mybondCalcForwardCP()
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} settleREFCPI settlement date REFCPI (t0)
 * @param {number} forwardREFCPI date REFCPI on forward date (t1)
 * @param {number} inflator trend inflation rate (decimal) (from t1 to t2)
 * @param {boolean} seasonal [default = false] include seasonal adjustments if true, otherwise straight trend inflation. 
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 *
 * @return {[[date,cashflow,cumCouponReturn,cumDiscountReturn,currCoupon,currDiscountReturn]]} yield
 * @customfunction
 */
function mybondTipsInterestPaid(
  purchased,
  settle,
  maturity,
  coupon,
  datedREFCPI,
  forceRefresh = false
) {
  // XXXX - factors needed: settle, maturity, forward, 1st coupon date (maturity - 6 mos.)
  // XXXX - the pre-fwd Coupon creates the need to look up REFCPI directly....

  const settleDate = mydateNormalize_(settle);
  const purchaseDate = mydateNormalize_(purchased);
  const maturityDate = mydateNormalize_(maturity);
  // flag if maturity is before forward date - special case.
  const matureBeforeForward = mydateLessThan_(maturityDate, purchaseDate) || forwardRealCP === null || forwardRealCP === '';

  const schedule = mybondCouponSchedule(purchaseDateDate, maturityDate);
  if (schedule.length === 0) return null;

  // settle accrued interest and dirty price.
  const settleAccruedRealInterest = mybondAccruedInterest(settleDate, maturityDate, coupon, schedule);
  const settleAccruedNominalInterest = settleIR * settleAccruedRealInterest;
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
  let cumCoupon = 0;
  let cumDiscount = 0;
  let cumKnownDiscount = 0;
  //let cumFutureDiscount = 0;
  let lastDiscountDate = settleDate;
  let cumSA = 0;
  for (let i = 0; i < N; i++) {
    const couponDate = schedule[i];

    // let's tee up the coupon, make sure it is valid and where it stand related to the forward date.
    const fwdYrs = mydateDaysBetween_(purchaseDate, couponDate) / 365;
    const preFwdCoupon = mydateLessThan_(couponDate, purchaseDate);
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

    const currCoupon = couponIR * semiRealCoupon - (i === 0 ? settleAccruedNominalInterest : 0);
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
      mybondRoundPrice(flow),
      mybondRoundPrice(cumKnownInflation),
      mybondRoundPrice(cumFutureInflation),
      mybondRoundPrice(cumCoupon),
      mybondRoundPrice(cumDiscount),
      mybondRoundPrice(cumSA),
      mybondRoundPrice(currKnownInflation),
      mybondRoundPrice(currFutureInflation),
      mybondRoundPrice(currCoupon),
      mybondRoundPrice(currDiscount),
      mybondRoundPrice(currSA),
      mybondRoundPrice(currTrendInflation),
      mybondRoundREFCPI(couponIR),
      mybondRoundSeasonal(couponSaFactor),
      mybondRoundPrice(currTotalReturnSA),
    ]);
  }

  // maturity cashflow reported with last coupon entry in coupon loop.
  // prepend the purchase cash flow (no returns)
  results.unshift([
    settleDate,
    mybondRoundPrice(-settleNominalDirtyPrice)
  ]);

  // run XIRR to get a rate.
  const cf = results.map(row => row[1]);
  const dates = results.map(row => row[0]);
  const rate = mybondRoundYield(xirr_(cf, dates));

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
    "currTrendInflation",
    "couponIR",
    "couponSaFactor",
    "currTotalReturnSA",
  ]);

  // prepend XIRR rate and totals for easy access.
  results.unshift([
    "irr/totals",
    rate,
    mybondRoundPrice(cumKnownInflation),
    mybondRoundPrice(cumFutureInflation),
    mybondRoundPrice(cumCoupon),
    mybondRoundPrice(cumDiscount),
    mybondRoundPrice(cumSA),
    ,
    ,
    ,
    ,
    ,
    mybondRoundPrice(cumTrendInflation)
  ]);

  results.unshift([
    "forward SA YTM",
    matureBeforeForward ? 'maturity < forward' : mybondRoundYield(myYieldFromPrice(purchaseDate, maturityDate, coupon, forwardRealCP * forwardSaRatio)),
    ,
    ,
    ,
    ,
    mybondRoundSeasonal(forwardSaRatio),
  ]);

  results.unshift([
    "settle SA YTM",
    mybondRoundYield(myYieldFromPrice(settleDate, maturityDate, coupon, settleRealCP * settleSaRatio)),
    ,
    ,
    ,
    ,
    mybondRoundSeasonal(settleSaRatio),
  ]);

  results.unshift([
    "settle YTM",
    mybondRoundYield(myYieldFromPrice(settleDate, maturityDate, coupon, settleRealCP)),
    ,
    ,
    coupon,
    mybondRoundPrice(100 - settleRealCP),
  ]);

  return results;
}