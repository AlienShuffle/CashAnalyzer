/**
 * Calculates the forward clean price of a nominal Treasury
 * note or bond.
 *
 * Carries the dirty value from settlement (t0) to the
 * forward date (t1), while removing coupons paid between
 * settlement and the forward date.
 *
 * Unlike the TIPS version, there is no inflation/index-ratio
 * conversion. All values are already nominal dollars per
 * $100 face value.
 *
 * Coupons occurring ON the forward date are treated as
 * belonging to the original holder and are therefore removed.
 * The resulting forward bond value is ex-coupon on that date.
 *
 * A clean price above $100 is completely valid and requires
 * no special treatment.
 *
 * Forward pricing relationship:
 *
 *   DirtyForward =
 *       DirtySpot * Carry(t0,t1)
 *       - Sum[Coupon * Carry(couponDate,t1)]
 *
 * Then:
 *
 *   CleanForward =
 *       DirtyForward
 *       - AccruedInterest(t1)
 *
 * @param {Date} settle Current settlement date (t0)
 * @param {Date} forward Forward settlement date (t1)
 * @param {Date} maturity Maturity date
 * @param {number} coupon Annual nominal coupon rate (decimal)
 * @param {number} price Current quoted nominal clean price
 * @param {number} repoRate Repo/T-bill financing rate (decimal)
 *
 * @return {number|string} Forward quoted nominal clean price
 * @customfunction
 */
function mybondCalcNominalForwardCP(
  settle,
  forward,
  maturity,
  coupon,
  price,
  repoRate
) {

  const settleDate =
    mydateNormalize_(settle);

  const forwardDate =
    mydateNormalize_(forward);

  const maturityDate =
    mydateNormalize_(maturity);


  // --------------------------------------------------
  // 0. Validation
  // --------------------------------------------------

  if (mydateLessThan_(forwardDate, settleDate)) {
    throw new Error(
      "Forward date cannot precede settlement date"
    );
  }

  // Forward pricing after maturity is meaningless.
  if (mydateLessThan_(maturityDate, forwardDate)) {
    return "";
  }

  coupon = Number(coupon);
  price = Number(price);
  repoRate = Number(repoRate);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  if (!Number.isFinite(coupon) || coupon < 0) {
    throw new Error("Invalid coupon");
  }

  if (!Number.isFinite(repoRate)) {
    throw new Error("Invalid repo rate");
  }


  // --------------------------------------------------
  // 1. Convert quoted clean price to settlement
  //    dirty price.
  //
  // There is deliberately NO limitation to prices
  // below $100. Premium bonds are perfectly valid.
  // --------------------------------------------------

  const accrued0 =
    mybondAccruedInterest(
      settleDate,
      maturityDate,
      coupon
    );

  const dirty0 =
    price + accrued0;


  // --------------------------------------------------
  // 2. Carry settlement dirty value to forward date.
  //
  // Uses the same simple financing convention as
  // mybondCalcForwardCP().
  // --------------------------------------------------

  const days =
    mydateDaysBetween_(
      settleDate,
      forwardDate
    );

  const yearDays =
    mydateDaysInYearFrom_(
      settleDate
    );

  const dirty1BeforeCoupons =
    dirty0 *
    (
      1 +
      repoRate *
      days /
      yearDays
    );


  // --------------------------------------------------
  // 3. Remove coupons received by the current holder
  //    before OR ON the forward date.
  //
  // Each nominal Treasury coupon is simply:
  //
  //     100 * coupon / 2
  //
  // Each coupon received before t1 is carried from its
  // payment date to t1.
  //
  // A coupon exactly on t1 has zero carry and is
  // removed at face coupon value.
  // --------------------------------------------------

  const schedule =
    mybondCouponSchedule(
      settleDate,
      maturityDate
    );

  const couponAmount =
    100 * coupon / 2;

  let couponFV = 0;


  for (const couponDate of schedule) {

    // Stop only when couponDate > forwardDate.
    //
    // Therefore:
    //
    //   couponDate < forwardDate  -> remove + carry
    //   couponDate = forwardDate  -> remove, zero carry
    //   couponDate > forwardDate  -> forward holder gets it
    //
    if (mydateLessThan_(forwardDate, couponDate)) {
      break;
    }


    const couponCarryDays =
      mydateDaysBetween_(
        couponDate,
        forwardDate
      );


    // Coupon exactly on forward date.
    if (couponCarryDays === 0) {

      couponFV += couponAmount;
      continue;
    }


    const couponYearDays =
      mydateDaysInYearFrom_(
        couponDate
      );


    const couponForwardValue =
      couponAmount *
      (
        1 +
        repoRate *
        couponCarryDays /
        couponYearDays
      );


    couponFV +=
      couponForwardValue;
  }


  // --------------------------------------------------
  // 4. Dirty forward value net of intervening coupons.
  // --------------------------------------------------

  const dirty1 =
    dirty1BeforeCoupons -
    couponFV;


  // --------------------------------------------------
  // 5. Remove accrued interest as of the forward date
  //    to obtain quoted forward CLEAN price.
  //
  // On a coupon date, correctly implemented Treasury
  // accrued interest should be zero.
  // --------------------------------------------------

  const accrued1 =
    mybondAccruedInterest(
      forwardDate,
      maturityDate,
      coupon
    );

  const clean1 =
    dirty1 - accrued1;


  // --------------------------------------------------
  // 6. Return quoted forward clean price.
  // --------------------------------------------------

  return mybondRoundPrice(clean1);
}