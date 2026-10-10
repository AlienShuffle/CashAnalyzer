/**
 * Calculates a simple annualized rate for a target date using
 * two Treasury bill prices.
 *
 * Normally:
 *   1. Convert each T-bill price to a discount factor.
 *   2. Log-linearly interpolate discount factors to the target date.
 *   3. Convert the target discount factor to a simple annualized rate.
 *
 * If both T-bills have the same maturity date:
 *   - The target must equal that maturity date.
 *   - Calculate the simple rate implied by each bill.
 *   - Return the arithmetic average of those two rates.
 *
 * T-bill prices are expressed per $100 maturity value.
 *
 * Simple-rate convention:
 *
 *   1 / DF = 1 + r * days / yearDays
 *
 * therefore:
 *
 *   r = (1 / DF - 1) * yearDays / days
 *
 * @param {Date} settle Settlement date
 * @param {Date} target Target/forward date
 * @param {Date} maturity1 First T-bill maturity
 * @param {number} price1 First T-bill price per $100 face
 * @param {Date} maturity2 Second T-bill maturity
 * @param {number} price2 Second T-bill price per $100 face
 *
 * @return {number} Simple annualized rate as a decimal
 * @customfunction
 */
function myTbillSimpleRate(
  settle,
  target,
  maturity1,
  price1,
  maturity2,
  price2
) {

  // --------------------------------------------------
  // 0. Normalize input dates.
  // --------------------------------------------------

  const settleDate =
    mydateNormalize_(settle);

  const targetDate =
    mydateNormalize_(target);

  const date1 =
    mydateNormalize_(maturity1);

  const date2 =
    mydateNormalize_(maturity2);


  // --------------------------------------------------
  // 1. Convert dates to actual days from settlement.
  // --------------------------------------------------

  const targetDays =
    mydateDaysBetween_(
      settleDate,
      targetDate
    );

  const days1 =
    mydateDaysBetween_(
      settleDate,
      date1
    );

  const days2 =
    mydateDaysBetween_(
      settleDate,
      date2
    );


  if (targetDays <= 0) {
    throw new Error(
      "Target date must be after settlement date"
    );
  }

  if (days1 <= 0 || days2 <= 0) {
    throw new Error(
      "T-bill maturities must be after settlement date"
    );
  }


  // --------------------------------------------------
  // 2. Validate prices and convert them to discount
  //    factors.
  //
  // A T-bill pays $100 at maturity:
  //
  //   DF = Price / 100
  //
  // --------------------------------------------------

  const p1 = Number(price1);
  const p2 = Number(price2);

  if (
    !Number.isFinite(p1) ||
    !Number.isFinite(p2) ||
    p1 <= 0 ||
    p2 <= 0
  ) {
    throw new Error(
      "Invalid T-bill price"
    );
  }

  const df1 =
    p1 / 100;

  const df2 =
    p2 / 100;


  // --------------------------------------------------
  // 3. Determine the annual day-count denominator.
  //
  // This matches the simple-rate convention already
  // used by the forward pricing functions.
  // --------------------------------------------------

  const yearDays =
    mydateDaysInYearFrom_(
      settleDate
    );


  // --------------------------------------------------
  // 4. Same-maturity special case.
  //
  // This handles, for example, two T-bills in the input
  // data that both mature exactly on the requested
  // forward date.
  //
  // There is no maturity interval across which to
  // interpolate, so calculate each T-bill's simple
  // rate separately and average the rates.
  // --------------------------------------------------

  if (days1 === days2) {

    // Same maturity can only determine the rate at
    // that maturity.
    if (targetDays !== days1) {
      throw new Error(
        "Same-maturity T-bills do not bracket the target date"
      );
    }

    const rate1 =
      (
        1 / df1 - 1
      ) *
      yearDays /
      days1;

    const rate2 =
      (
        1 / df2 - 1
      ) *
      yearDays /
      days2;

    return (
      rate1 + rate2
    ) / 2;
  }


  // --------------------------------------------------
  // 5. Verify that the two different T-bill maturities
  //    bracket the target date.
  //
  // Math.min/max makes argument order irrelevant.
  // --------------------------------------------------

  const minDays =
    Math.min(
      days1,
      days2
    );

  const maxDays =
    Math.max(
      days1,
      days2
    );

  if (
    targetDays < minDays ||
    targetDays > maxDays
  ) {
    throw new Error(
      "Target date is not bracketed by T-bill maturities"
    );
  }


  // --------------------------------------------------
  // 6. Calculate the interpolation position.
  //
  //   w = (target - t1) / (t2 - t1)
  //
  // This also works if maturity2 happens to precede
  // maturity1 because both numerator and denominator
  // adjust consistently.
  // --------------------------------------------------

  const w =
    (
      targetDays - days1
    ) /
    (
      days2 - days1
    );


  // --------------------------------------------------
  // 7. Log-linear interpolation of discount factors.
  //
  //   ln DF(target)
  //       =
  //   ln DF1
  //       +
  //   w * [ln DF2 - ln DF1]
  //
  // --------------------------------------------------

  const logDf =
    Math.log(df1) +
    w *
    (
      Math.log(df2) -
      Math.log(df1)
    );

  const targetDf =
    Math.exp(logDf);


  // --------------------------------------------------
  // 8. Convert the interpolated target discount factor
  //    into the simple annual rate expected by the
  //    forward-pricing functions.
  //
  // Starting with:
  //
  //   1 / DF
  //       =
  //   1 + r * targetDays / yearDays
  //
  // Solve for r:
  //
  //   r
  //       =
  //   (1 / DF - 1)
  //       * yearDays
  //       / targetDays
  //
  // --------------------------------------------------

  const simpleRate =
    (
      1 / targetDf - 1
    ) *
    yearDays /
    targetDays;


  // --------------------------------------------------
  // 9. Return decimal annual rate.
  //
  // Example:
  //
  //   0.04325 means 4.325%
  //
  // --------------------------------------------------

  return simpleRate;
}