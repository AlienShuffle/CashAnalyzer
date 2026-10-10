/**
 * Calculates a quoted TIPS clean price from an annual-effective XIRR
 * and projected nominal (inflation-adjusted) TIPS cash flows.
 *
 * This is intended as the inverse of xirr_():
 *
 *     nominal cash flows -> XIRR
 *     XIRR + same cash flows -> nominal PV
 *
 * The nominal PV is then converted back to the quoted real TIPS
 * price using the settlement index ratio.
 *
 * cashFlows format:
 * [
 *   [date, cashflow, cumCoupon, cumDiscount, currCoupon, currDiscount],
 *   ...
 * ]
 *
 * @param {Date} settle Settlement date
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual real coupon rate (decimal)
 * @param {number} yld Annual-effective XIRR (decimal)
 * @param {number} settleIR Index ratio at settlement
 * @param {Array[]} cashFlows Nominal/inflation-adjusted future cash flows
 *
 * @return {number} Quoted real clean price
 * @customfunction
 */
function mytipsPriceFromXirr(
  settle,
  maturity,
  coupon,
  yld,
  settleIR,
  cashFlows
) {

  const settleDate = mydateNormalize_(settle);
  const maturityDate = mydateNormalize_(maturity);

  // ------------------------------
  // Validation
  // ------------------------------
  Logger.log(`coupon=${coupon}`);
  Logger.log(`yld=${yld}`);
  if (yld === null || yld === undefined)
    return null;

  if (settleIR <= 0)
    throw new Error(
      `Invalid settlement index ratio=${settleIR}`
    );

  if (mydateLessThan_(maturityDate, settleDate))
    return null;

  if (!Array.isArray(cashFlows) ||
    cashFlows.length === 0)
    throw new Error(
      "No TIPS cash flows supplied"
    );

  // XIRR requires 1 + yld > 0.
  if (yld <= -1)
    throw new Error(
      `Invalid XIRR=${yld}`
    );

  // ------------------------------
  // 1. PV nominal cash flows
  // ------------------------------

  let nominalDirtyPV = 0;

  for (let i = 0; i < cashFlows.length; i++) {

    const cashFlowDate =
      mydateNormalize_(cashFlows[i][0]);

    const cashFlow =
      Number(cashFlows[i][1]);

    if (!Number.isFinite(cashFlow))
      throw new Error(
        `Invalid cash flow at row ${i}`
      );

    const days =
      mydateDaysBetween_(
        settleDate,
        cashFlowDate
      );

    if (days < 0)
      throw new Error(
        `Cash flow precedes settlement at row ${i}`
      );

    // Must match xirr_() exactly.
    const yrs = days / 365;

    nominalDirtyPV +=
      cashFlow /
      Math.pow(1 + yld, yrs);
    Logger.log(`${i}: nominalDirtyPV=${nominalDirtyPV}`);
  }

  // ------------------------------
  // 2. Convert nominal/indexed PV
  //    back to quoted real dirty
  // ------------------------------

  const realDirtyPV =
    nominalDirtyPV / settleIR;

  // ------------------------------
  // 3. Remove real accrued interest
  // ------------------------------

  const accrued =
    mybondAccruedInterest(
      settleDate,
      maturityDate,
      coupon
    );

  Logger.log(`accrued=${accrued}`);
  const realCleanPrice =
    realDirtyPV - accrued;

  Logger.log(`realCleanPrice=${realCleanPrice}`);
  return mybondRoundPrice_(realCleanPrice);
}