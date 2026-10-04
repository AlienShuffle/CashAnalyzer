// A bunch of conversion helper functions from z(t) rates to different forms of yields, discount factors, etc.

/**
 * from svensson curve
 * const zCc = svenssonZero_(t, params);
 * 
 * to discount factor
 * const df =  myZeroCcToDF_(zCc, t);
 * 
 * or BEY
 * const zeroBey = myZeroCcToBEY_(zCc);
 * 
 * or short-term simple rate
 * const simpleRate = myDFToSimpleRate_(df, days, yearDays);
 * 
 * 
 */
function twoCurvePoints(z1, t1, z2, t2) {
  const df1 =
    myZeroCcToDF(z1, t1);

  const df2 =
    myZeroCcToDF(z2, t2);

  const forwardCc =
    myForwardCcFromDF_(
      df1,
      df2,
      t1,
      t2
    );

  const carryFactor =
    myForwardCarryFactor_(
      df1,
      df2
    );
}

/**
 * Continuously compounded zero rate -> discount factor.
 *
 * DF(t) = exp(-z * t)
 *
 * @param {number} z Continuously compounded zero rate, decimal
 * @param {number} t Time in years
 * @return {number} Discount factor
 */
function myZeroCcToDF(z, t) {
  if (t < 0) throw new Error("t cannot be negative");
  if (t === 0) return 1;

  return Math.exp(-z * t);
}


/**
 * Discount factor -> continuously compounded zero rate.
 *
 * z(t) = -ln(DF) / t
 *
 * @param {number} df Discount factor
 * @param {number} t Time in years
 * @return {number} Continuously compounded zero rate, decimal
 */
function myDFToZeroCc(df, t) {
  if (df <= 0) throw new Error("DF must be positive");
  if (t <= 0) throw new Error("t must be positive");

  return -Math.log(df) / t;
}


/**
 * Continuously compounded zero rate -> bond-equivalent
 * zero yield (semiannual compounding).
 *
 * zBEY = 2 * (exp(zCC / 2) - 1)
 *
 * @param {number} zCc Continuously compounded rate, decimal
 * @return {number} Bond-equivalent rate, decimal
 */
function myZeroCcToBEY(zCc) {
  return 2 * (Math.exp(zCc / 2) - 1);
}


/**
 * Bond-equivalent zero yield -> continuously compounded
 * zero rate.
 *
 * zCC = 2 * ln(1 + zBEY / 2)
 *
 * @param {number} zBey Bond-equivalent rate, decimal
 * @return {number} Continuously compounded rate, decimal
 */
function myZeroBEYToCc(zBey) {
  if (1 + zBey / 2 <= 0)
    throw new Error("Invalid BEY");

  return 2 * Math.log(1 + zBey / 2);
}


/**
 * Discount factor -> bond-equivalent zero yield.
 *
 * Convenience function using continuous rate internally.
 *
 * @param {number} df Discount factor
 * @param {number} t Years
 * @return {number} Bond-equivalent zero yield, decimal
 */
function myDFToZeroBEY(df, t) {
  return myZeroCcToBEY(
    myDFToZeroCc(df, t)
  );
}


/**
 * Bond-equivalent zero yield -> discount factor.
 *
 * DF = 1 / (1 + y/2)^(2t)
 *
 * @param {number} y Bond-equivalent zero yield, decimal
 * @param {number} t Years
 * @return {number} Discount factor
 */
function myZeroBEYToDF_(y, t) {
  if (t < 0) throw new Error("t cannot be negative");
  if (t === 0) return 1;
  if (1 + y / 2 <= 0)
    throw new Error("Invalid BEY");

  return 1 /
    Math.pow(1 + y / 2, 2 * t);
}


/**
 * Discount factor -> simple annualized rate.
 *
 * 1 / DF = 1 + r * days / yearDays
 *
 * therefore:
 *
 * r = (1/DF - 1) * yearDays / days
 *
 * Useful for converting a discount factor into the convention
 * currently used by mybondCalcForwardCP().
 *
 * @param {number} df Discount factor
 * @param {number} days Actual days
 * @param {number} yearDays 365 or 366
 * @return {number} Simple annual rate, decimal
 * @customfunction
 */
function myDFToSimpleRate(df, days, yearDays) {
  if (df <= 0) throw new Error("DF must be positive");
  if (days <= 0) throw new Error("days must be positive");
  if (yearDays <= 0) throw new Error("yearDays must be positive");

  return (
    (1 / df - 1) *
    yearDays /
    days
  );
}


/**
 * Simple annualized rate -> discount factor.
 *
 * DF = 1 / (1 + r * days/yearDays)
 *
 * @param {number} rate Simple annualized rate, decimal
 * @param {number} days Actual days
 * @param {number} yearDays 365 or 366
 * @return {number} Discount factor
 */
function mySimpleRateToDF_(rate, days, yearDays) {
  if (days < 0) throw new Error("days cannot be negative");
  if (days === 0) return 1;
  if (yearDays <= 0) throw new Error("yearDays must be positive");

  return 1 /
    (
      1 +
      rate * days / yearDays
    );
}


/**
 * Continuously compounded forward rate between t1 and t2,
 * given their discount factors.
 *
 * f(t1,t2) = -ln(DF2 / DF1) / (t2 - t1)
 *
 * @param {number} df1 Discount factor at t1
 * @param {number} df2 Discount factor at t2
 * @param {number} t1 Years from settlement
 * @param {number} t2 Years from settlement
 * @return {number} Continuously compounded forward rate
 */
function myForwardCcFromDF_(df1, df2, t1, t2) {
  if (df1 <= 0 || df2 <= 0)
    throw new Error("Discount factors must be positive");

  if (t2 <= t1)
    throw new Error("t2 must be greater than t1");

  return -Math.log(df2 / df1) /
    (t2 - t1);
}


/**
 * Forward discount factor from t1 to t2.
 *
 * DF(t1,t2) = DF(t2) / DF(t1)
 *
 * @param {number} df1 Spot discount factor to t1
 * @param {number} df2 Spot discount factor to t2
 * @return {number} Forward discount factor
 */
function myForwardDF_(df1, df2) {
  if (df1 <= 0 || df2 <= 0)
    throw new Error("Discount factors must be positive");

  return df2 / df1;
}


/**
 * Forward accumulation/carry factor from t1 to t2.
 *
 * Carry = DF(t1) / DF(t2)
 *
 * $1 at t1 grows to this amount at t2.
 *
 * @param {number} df1 Spot discount factor to t1
 * @param {number} df2 Spot discount factor to t2
 * @return {number} Forward accumulation factor
 */
function myForwardCarryFactor_(df1, df2) {
  if (df1 <= 0 || df2 <= 0)
    throw new Error("Discount factors must be positive");

  return df1 / df2;
}