// mybond.xirr.gs

/**
* Robust XIRR implementation for Google Apps Script. Handles dates from sheets reasonably well.
* returns annualized effective yield (internal rate of return), not a bond equivalent yield.
*
* Uses in order:
*   1. Newton-Raphson (fast)
*   2. Binary Search fallback (robust)
*
* Returns annual effective yield.
*
* @param {number[]} cashFlows
* @param {Date[]} dates
* @param {number} guess OPTIONAL. default = 0.05, decimal guess at yield to seed the solver.
* @returns {number}
* @customfunction
*/
function mybondXIRR(cashFlows, dates, guess = 0.05) {
  const goodDates = mydatesNormalize_(dates);
  return mybondRoundYield(xirr_(cashFlows, goodDates, guess));
}

/**
 * Robust XIRR implementation for Google Apps Script.
 *
 * Uses:
 *   1. Newton-Raphson (fast)
 *   2. Binary Search fallback (robust)
 *
 * Returns annual effective yield.
 *
 * @param {number[]} cf cash flow amounts
 * @param {Date[]} dates cash flow dates
 * @param {number} guess [0.1]
 * @returns {number}
 */
function xirr_(cf, dates, guess = 0.10) {

  if (cf.length !== dates.length) {
    throw new Error(
      "XIRR cashFlows and dates must have same length"
    );
  }

  const hasPositive = cf.some(v => v > 0);
  const hasNegative = cf.some(v => v < 0);

  if (!hasPositive || !hasNegative) {
    throw new Error(
      "XIRR requires at least one positive and one negative cash flow"
    );
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      throw new Error(
        "Cash flow dates must be in ascending order"
      );
    }
  }

  // get the length of each cash flow period in years.
  const t0 = dates[0];
  const years = dates.map(d =>
    mydateDaysBetween_(t0, d) / 365);

  function xnpv(rate) {

    let pv = 0;
    for (let i = 0; i < cf.length; i++) {
      pv += cf[i] / Math.pow(1 + rate, years[i]);
    }
    return pv;
  }

  function dxnpv(rate) {

    let deriv = 0;
    for (let i = 0; i < cf.length; i++) {
      deriv += -years[i] * cf[i] / Math.pow(1 + rate, years[i] + 1);
    }
    return deriv;
  }

  //-------------------------------------------------
  // 1. Newton-Raphson
  //-------------------------------------------------

  try {

    let rate = guess;
    for (let i = 0; i < 100; i++) {
      const f = xnpv(rate);
      const fp = dxnpv(rate);
      if (Math.abs(fp) < 1e-14) {
        throw new Error("Derivative too small");
      }
      const nextRate = rate - f / fp;
      if (Math.abs(nextRate - rate) < 1e-12) {
        return nextRate;
      }
      if (nextRate <= -0.999999) {
        throw new Error("Invalid rate");
      }
      rate = nextRate;
    }

  } catch (e) {
    // fall through to binary search
  }

  //-------------------------------------------------
  // 2. Binary Search Fallback
  //-------------------------------------------------

  let low = -0.999;
  let high = 10.0;

  let fLow = xnpv(low);
  let fHigh = xnpv(high);

  // Expand upper bound if needed
  while (
    Math.sign(fLow) === Math.sign(fHigh) &&
    high < 1000
  ) {
    high *= 2;
    fHigh = xnpv(high);
  }

  if (Math.sign(fLow) === Math.sign(fHigh)) {
    throw new Error(
      `Could not bracket root: low=${fLow} high=${fHigh}`
    );
  }

  for (let i = 0; i < 300; i++) {

    const mid = (low + high) / 2;
    const fMid = xnpv(mid);
    if (Math.abs(fMid) < 1e-12) {
      return mid;
    }

    if (Math.sign(fMid) === Math.sign(fLow)) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
      fHigh = fMid;
    }
  }
  return (low + high) / 2;
}