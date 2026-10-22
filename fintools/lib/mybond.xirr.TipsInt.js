// mybond.xirr.TipsInt.gs

/**
 * Calculates the nominal return (IRR) of a TIPS from a historical perspective for a cash flow starting at the purchase date
 * using actual published REFCPI data up to the asOfDate and potentially known forward date and inflation to the forward date (max REFCPI).
 * asOfDate must be after the purchase date and before the forward date and before maturity.
 * Uses an Google app script (javascript) XIRR implementation
 *
 * Seasonal Factors are not applied as all cash flows occur before the forward date.
 * Forward (maxREFCPI) date is calculated from the asOfDate.
 *
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 *
 * @param {Date} purchase TIPS purchase date (t0)
 * @param {Date} asOf date the historical returns ends (must be after purchase date and before forward date and before maturity) (t1)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} purchaseRealCP purchase real Clean Price (t0)
 * @param {number} asOfDateRealCP as of date (t1) real Clean Price)
 * @param {number} datedREFCPI dated date REFCPI
 *
 * @return {[[netInterest,IRR]]}
 * @customfunction
 */
function mybondTipsNominalHistoryReturn(
  purchase, asOf, maturity,
  coupon,
  purchaseRealCP, asOfDateRealCP,
  datedREFCPI,
) {

  // to ensure re-use and consistency, use the Graph table function below to produce the XIRR Results
  // just return the calculated rate.
  const result = mybondGraphTipsNominalHistory(
    purchase, asOf, maturity,
    coupon,
    purchaseRealCP, asOfDateRealCP,
    datedREFCPI,
  );
  if (result === null) return null;
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i][0] === 'irr/totals') return [[result[i][1], result[i][3]]];
  }
  throw `xirr failed: irr/totals not found: ${result[0][0]}`
}

/**
 * Returns a table for graphing the nominal TIPS return (IRR) from a historical perspective for a cash flow starting at the purchase date
 * using published REFCPI data up to the asOfDate and potentially known forward date and inflation to the forward date (max REFCPI).
 * asOfDate must be after the purchase date and on orbefore the forward and maturity dates.
 * Uses an Google app script (javascript) XIRR implementation
 *
 * Seasonal Factors are not applied as all cash flows occur before the forward date.
 * Forward (maxREFCPI) date is calculated from the asOfDate.
 *
 * Years are calculated on a strict 365 day fraction consistent with my understanding of XIRR conventions.
 * Uses an Google app script (javascript) XIRR implementation model.
 * 1st two columns can be provided to xirr for your own irr calculation.
 *
 * @param {Date} purchase TIPS purchase date (t0)
 * @param {Date} asOf date the historical returns ends (must be after purchase date and before forward date and before maturity) (t1)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} purchaseRealCP purchase real Clean Price (t0)
 * @param {number} asOfDateRealCP as of date (t1) real Clean Price; can be obtained by mybondCalcForwardCP()
 * @param {number} datedREFCPI dated date REFCPI
 *
 * @return {[[date,cashflow,couponIR,cumulativeCoupon]]} yield
 * @customfunction
 */
function mybondGraphTipsNominalHistory(
  purchase, asOf, maturity,
  coupon,
  purchaseRealCP, asOfDateRealCP,
  datedREFCPI,
) {

  const purchaseDate = mydateNormalize_(purchase);
  const asOfDate = mydateNormalize_(asOf);
  const maturityDate = mydateNormalize_(maturity);
  const forwardDate = mydateNormalize_(tipsGetMaxRefCpiDate(asOfDate));

  if (!purchaseDate || !asOfDate || !maturityDate) return null;
  // asOf date can be = maturity and /or forward date.
  // purchase date must be before asOf date.
  if (!mydateLessThan_(purchaseDate, asOfDate) || mydateLessThan_(maturityDate, asOfDate)) return null;
  if (mydateLessThan_(forwardDate, asOfDate)) return null;

  const purchaseREFCPI = tipsGetRefCpi(purchaseDate);
  if (!purchaseREFCPI) throw new Error("Failed to get purchase REFCPI");
  const purchaseIR = purchaseREFCPI / datedREFCPI;

  const asOfREFCPI = tipsGetRefCpi(asOfDate);
  if (!asOfREFCPI) throw new Error("Failed to get asOf REFCPI");
  const asOfIR = asOfREFCPI / datedREFCPI;

  const schedule = mybondCouponSchedule_(purchaseDate, maturityDate);
  if (schedule.length === 0) return null;

  // purchase accrued interest and dirty price.
  const purchaseRealAccruedInterest = mybondAccruedInterest(purchaseDate, maturityDate, coupon, schedule);
  const purchaseNominalAccruedInterest = purchaseIR * purchaseRealAccruedInterest;
  const purchaseNominalDirtyPrice = purchaseIR * (purchaseRealCP + purchaseRealAccruedInterest);

  const N = schedule.length;
  const semiRealCoupon = 100 * coupon / 2;
  const results = [];

  // Attribute purchased accrued interest at settlement, not against the first coupon.
  results.push([
    purchaseDate,
    mybondRoundPrice_(-purchaseNominalDirtyPrice),
    mybondRoundREFCPI_(purchaseIR),
    mybondRoundPrice_(-purchaseRealAccruedInterest * purchaseIR)
  ]);
  let cumulativeCoupon = -purchaseNominalAccruedInterest;

  // calculate each coupon cash flow including maturity
  // Also calculate cumulative and current coupon, discount, SA factor, and inflation metrics.
  for (let i = 0; i < N; i++) {

    const couponDate = schedule[i];

    // if coupon date is on or before the asOf date, include it in the cash flow calculation.
    // otherwise we are done with coupons.
    if (mydateLessThan_(asOfDate, couponDate)) break;

    const couponREFCPI = tipsGetRefCpi(couponDate);
    if (!couponREFCPI) throw new Error("Failed to get coupon REFCPI for ${couponDate}");

    const couponIR = couponREFCPI / datedREFCPI;
    const cf = couponIR * (semiRealCoupon + (i === N - 1 ? 100 : 0));
    const currCoupon = couponIR * semiRealCoupon
    cumulativeCoupon += currCoupon;

    // enter coupon table entry.
    results.push([
      couponDate,
      mybondRoundPrice_(cf),
      mybondRoundREFCPI_(couponIR),
      mybondRoundPrice_(currCoupon)
    ]);
  }

  // enter a sale/redemption on asOf date table entry.
  // asOf accrued interest and dirty price.
  const asOfRealAccruedInterest = mybondAccruedInterest(asOfDate, maturityDate, coupon);
  const asOfNominalAccruedInterest = asOfIR * asOfRealAccruedInterest;
  const asOfNominalDirtyPrice = asOfIR * (asOfDateRealCP + asOfRealAccruedInterest);
  cumulativeCoupon += asOfNominalAccruedInterest;

  results.push([
    asOfDate,
    mybondRoundPrice_(asOfNominalDirtyPrice),
    mybondRoundREFCPI_(asOfIR),
    mybondRoundPrice_(asOfNominalAccruedInterest)
  ]);

  // run XIRR to get a rate.
  const cf = results.map(row => row[1]);
  const dates = results.map(row => row[0]);
  const rate = mybondRoundYield_(xirr_(cf, dates));

  // header row
  results.unshift([
    "Date",
    "Cashflow",
    "IndexRatio",
    "Coupon",
  ]);

  // prepend XIRR rate and totals for easy access.
  results.unshift([
    "irr/totals",
    rate,
    mybondRoundREFCPI_(asOfIR),
    mybondRoundPrice_(cumulativeCoupon)
  ]);

  return results;
}