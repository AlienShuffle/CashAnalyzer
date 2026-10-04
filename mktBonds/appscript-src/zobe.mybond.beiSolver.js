/**
 *  XXXX Note, these BEI solver functions appear to introduce significant noise, and I prefer to use the yield directly.
 *  XXXX This was originally written before I knew how to get a solid forward clean price (see above)
 *  XXXX and then run through a seasonal adjustment.
 * 
 * Calculates the implied break-even inflation rate (BEI) for a TIPS given the rate for a Treasury instrument maturing on the same date.
 * This is intented for TIPS maturing in less than one year, but in theory can work for longer maturities.
 * Uses a binary search solver algorithm. This assumes a consistent Trend Inflation.
 *
 * @param {Date} forward Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} cleanPrice Forward clean price
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} fwdREFCPI date REFCPI
 * @param {number} treasuryYield Treasury/T-bill yield (decimal)
 *
 * @return {number}
 * @customfunction
 */
function mybondBEISolver(forward, maturity, cleanPrice, coupon, datedREFCPI, fwdREFCPI, treasuryYield) {
  return mybondBEISolverSA(forward, maturity, cleanPrice, coupon, datedREFCPI, fwdREFCPI, treasuryYield);
}

/**
 * XXXX - this is OBE, but I keep around as an excellent design pattern for a generic binary search solver.
 * 
 * Calculates the implied break-even inflation rate (BEI) for a TIPS given the rate for a Treasury instrument maturing on the same date.
 * This is intented for TIPS maturing in less than one year, but in theory can work for longer maturities.
 * Uses a binary search solver algorithm. This assumes a Seasonally Adjusted Trend Inflation rate.
 *
 * Solves for the annualized break-even inflation rate (BEI) that makes the
 * discounted value of projected TIPS cash flows equal to the specified
 * forward purchase value.
 *
 * The function projects future index ratios using the proposed BEI,
 * computes all remaining coupon and principal cash flows, discounts them
 * using the supplied nominal Treasury/T-bill yield, and uses a binary
 * search to find the BEI that equates present value to the purchase value
 * 
 * @param {Date} forward Forward settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual coupon rate (decimal)
 * @param {number} cleanPrice Forward clean price
 * @param {number} datedREFCPI dated date REFCPI
 * @param {number} fwdREFCPI date REFCPI
 * @param {number} treasuryYield Treasury/T-bill yield (decimal)
 * @param {number[[]]} factors array of 12 Seasonal Adjustment factors [[month1Day1,dailyDelta]...[month12Day1,dailyDelta]]
 *
 * @return {number}
 * @customfunction
 */
function mybondBEISolverSA(forward, maturity, coupon, cleanPrice, datedREFCPI, fwdREFCPI, treasuryYield, factors = []) {

  const forwardDate = mydateNormalize_(forward);
  const maturityDate = mydateNormalize_(maturity);

  const { w, N, schedule } = mybondGetFacts_(forwardDate, maturityDate);

  const rai = mybondAccruedInterest(forwardDate, maturityDate, coupon, schedule);
  const fwdIR = fwdREFCPI / datedREFCPI;
  const fwdDirtyPrice = (cleanPrice + rai) * fwdIR;  // clean would be the price as provided instead of the IndexedValue.

  const maturitySAFactor = tipsGetFactor(maturityDate, factors);

  /**
   * This is the error calculation for the Solver below.
   * Calculates a pv using provided BEI, returns delta to benchmark price.
   * Note, this function depends upon variables defined above:
   *   forwardDate, maturitySAFactor, fwdDirtyPrice, coupon, datedREFCPI, fwdREFCPI, tBillYield, schedule, factors
   * @param {number} inflator break even inflation rate under test.
   * @returns {number}
   */
  const beiErrorFunc = function (inflator) {

    let pv = 0;
    for (let i = 0; i < N; i++) {

      const couponDate = schedule[i];
      const yrs = mydateDaysBetween_(forwardDate, couponDate) / 365;
      const projectedIR = fwdREFCPI * Math.pow(1 + inflator, yrs) / datedREFCPI;
      const saRatio = tipsGetFactor(couponDate, factors) / maturitySAFactor;
      const cf = 100 * projectedIR * saRatio * ((i == N - 1 ? 1 : 0) + coupon / 2);

      const exponent = w + i;
      pv += cf / Math.pow(1 + treasuryYield / 2, exponent);
    }
    return pv - fwdDirtyPrice;
  };

  // call the solver function with the BEI function as a parameter.
  const bei = binarySolver(beiErrorFunc);
  return mybondRoundYield(bei);
}

/**
  * Generic binary search root finder.
  *
  * @param {Function} errorFunc
  * @param {number} low
  * @param {number} high
  * @param {number} tolerance
  * @param {number} maxIterations
  * @returns {number}
  */
function binarySolver(
  errorFunc,
  low = -0.10,
  high = 0.20,
  tolerance = 1e-12,
  maxIterations = 200
) {

  let errorLow = errorFunc(low);
  let errorHigh = errorFunc(high);

  if (Math.sign(errorLow) === Math.sign(errorHigh)) {
    throw new Error(
      `Root not bracketed. Error(low)=${errorLow}, Error(high)=${errorHigh}`
    );
  }

  let mid;
  for (let i = 0; i < maxIterations; i++) {
    mid = (low + high) / 2;
    const errorMid = errorFunc(mid);
    if (Math.abs(errorMid) < tolerance) {
      return mid;
    }
    if (errorMid * errorLow < 0) {
      high = mid;
      errorHigh = errorMid;
    } else {
      low = mid;
      errorLow = errorMid;
    }
  }
  return mid;
}