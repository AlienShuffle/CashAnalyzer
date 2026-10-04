// mybond.calcForwardCP.gs

/**
 * Calculates the forward clean price of a TIPS.
 *
 * Carries the nominal/indexed dirty value from settlement (t0)
 * to the forward date (t1), while removing any coupons paid
 * between settlement and the forward date.
 *
 * Each intervening coupon is valued using its coupon-date
 * index ratio and carried from its payment date to the
 * forward date. (TIPS case, at most 1 coupon is expected though)
 * 
 * Note: Intervening coupons are defined as coupon dates strictly before
 * the forward date. A coupon occurring exactly on the forward date is
 * therefore not removed. In the intended TIPS application this boundary
 * case does not arise because coupon dates are on the 15th while forward
 * dates are on the 1st.
 *
 * @param {Date} settle Current settlement date (t0)
 * @param {Date} forward Forward settlement date (t1)
 * @param {Date} maturity Maturity date (t2)
 * @param {number} coupon Annual real coupon rate (decimal)
 * @param {number} price Current quoted real clean price
 * @param {number} datedRefCpi TIPS dated-date REFCPI
 * @param {number} settleRefCpi Settlement-date REFCPI
 * @param {number} forwardRefCpi Forward-date REFCPI
 * @param {number} repoRate Repo/T-bill financing rate (decimal)
 *
 * @return {number|string} Forward quoted real clean price
 * @customfunction
 */
function mybondCalcForwardCP(
  settle,
  forward,
  maturity,
  coupon,
  price,
  datedRefCpi,
  settleRefCpi,
  forwardRefCpi,
  repoRate
) {

  // mydateNormalize_() ensures dates even from Sheets are turned in Date objects.
  const settleDate = mydateNormalize_(settle);
  const forwardDate = mydateNormalize_(forward);
  const maturityDate = mydateNormalize_(maturity);

  // --------------------------------------------------
  // 0. Validation
  // --------------------------------------------------

  if (mydateLessThan_(forwardDate, settleDate))
    throw new Error("Forward date cannot precede settlement date");

  // If forward date is AFTER maturity date return empty. Forward calcs make no sense.
  if (mydateLessThan_(maturityDate, forwardDate)) return "";

  if (datedRefCpi <= 0 ||
    settleRefCpi <= 0 ||
    forwardRefCpi <= 0) {
    throw new Error("REFCPI values must be positive");
  }

  if (!price || price <= 0) return null;

  // --------------------------------------------------
  // 1. Convert quoted real clean price to
  //    settlement real dirty price.
  // --------------------------------------------------
  const rai0 = mybondAccruedInterest(settleDate, maturityDate, coupon);
  const realDirty0 = price + rai0;

  // --------------------------------------------------
  // 2. Convert settlement real dirty price to
  //    nominal/indexed dirty value.
  // --------------------------------------------------
  const settleIR = settleRefCpi / datedRefCpi;
  const indexedDirty0 = realDirty0 * settleIR;

  // --------------------------------------------------
  // 3. Carry entire settlement indexed dirty value
  //    from settlement to forward date.
  //
  // Using simple repo/T-bill carry.
  // --------------------------------------------------
  const days = mydateDaysBetween_(settleDate, forwardDate);
  const yearDays = mydateDaysInYearFrom_(settleDate);
  const indexedDirty1BeforeCoupons =
    indexedDirty0 *
    (
      1 +
      repoRate *
      days /
      yearDays
    );

  // --------------------------------------------------
  // 4. Identify intervening coupons and remove their
  //    forward values.
  //
  // Each coupon:
  //   nominalCoupon =
  //       realCoupon × coupon-date IR
  //
  // and then:
  //   couponFV =
  //       nominalCoupon
  //       × carry(coupon date -> forward date)
  //
  // --------------------------------------------------

  const schedule = mybondCouponSchedule(settleDate, maturityDate);
  let indexedCouponFV = 0;
  for (const couponDate of schedule) {

    // Forward holder receives coupons on or after
    // the forward date, so stop here.
    if (!mydateLessThan_(
      couponDate,
      forwardDate))
      break;

    // REFCPI is known for these intervening coupons
    // in intended max-REFCPI use case.
    const couponRefCpi = tipsGetRefCpi(couponDate);
    const couponIR = couponRefCpi / datedRefCpi;

    // Actual indexed-dollar coupon payment.
    const indexedCoupon = couponIR * 100 * coupon / 2;

    // Carry coupon proceeds from the date received
    // to the forward date.
    const couponCarryDays = mydateDaysBetween_(couponDate, forwardDate);
    const couponYearDays = mydateDaysInYearFrom_(couponDate);

    const couponForwardValue =
      indexedCoupon *
      (
        1 +
        repoRate *
        couponCarryDays /
        couponYearDays
      );

    indexedCouponFV += couponForwardValue;
  }

  // --------------------------------------------------
  // 5. Nominal/indexed dirty forward value,
  //    net of intervening coupons.
  // --------------------------------------------------
  const indexedDirty1 = indexedDirty1BeforeCoupons - indexedCouponFV;

  // --------------------------------------------------
  // 6. Convert nominal/indexed dirty value back to
  //    quoted real dirty forward price.
  // --------------------------------------------------
  const forwardIR = forwardRefCpi / datedRefCpi;
  const realDirty1 = indexedDirty1 / forwardIR;

  // --------------------------------------------------
  // 7. Remove accrued interest to obtain the quoted
  //    real forward clean price at t1.
  // --------------------------------------------------
  const rai1 = mybondAccruedInterest(forwardDate, maturityDate, coupon);
  const realClean1 = realDirty1 - rai1;

  return mybondRoundPrice(realClean1);
}