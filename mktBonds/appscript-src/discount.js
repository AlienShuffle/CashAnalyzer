/**
 * Calculates a discount factor for a target date by log-linear
 * interpolation between two Treasury bills.
 *
 * Bill prices are expressed per $100 maturity value.
 *
 * @param {Date} settle Settlement date
 * @param {Date} target Target/forward date
 * @param {Date} maturity1 Earlier T-bill maturity
 * @param {number} price1 Earlier T-bill price per 100
 * @param {Date} maturity2 Later T-bill maturity
 * @param {number} price2 Later T-bill price per 100
 *
 * @return {number} Discount factor from settlement to target
 */
function myTbillDiscountFactor_(
  settle,
  target,
  maturity1,
  price1,
  maturity2,
  price2
) {

  const settleDate = mydateNormalize_(settle);

  const targetDate = mydateNormalize_(target);
  const date1 = mydateNormalize_(maturity1);
  const date2 = mydateNormalize_(maturity2);

  const t =
    mydateDaysBetween_(
      settleDate,
      targetDate
    );

  const t1 =
    mydateDaysBetween_(
      settleDate,
      date1
    );

  const t2 =
    mydateDaysBetween_(
      settleDate,
      date2
    );


  if (t1 === t2)
    throw new Error(
      "T-bill maturities must be different"
    );

  if (t < t1 || t > t2)
    throw new Error(
      "Target date is not bracketed by T-bill maturities"
    );


  // A T-bill is a zero coupon security.
  const df1 =
    Number(price1) / 100;

  const df2 =
    Number(price2) / 100;


  if (df1 <= 0 || df2 <= 0)
    throw new Error(
      "Invalid T-bill price"
    );


  // Fraction of the interval between the two maturities.
  const w = (t - t1) / (t2 - t1);


  // Log-linear interpolation of discount factors.
  const logDf =
    Math.log(df1) +
    w *
    (
      Math.log(df2) -
      Math.log(df1)
    );


  return Math.exp(logDf);
}