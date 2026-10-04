// Conversions among zero rates, discount factors, bond-equivalent yields and simple rates.
// Ported from zero.conversions.gs (the unused twoCurvePoints stub is not ported).

/** Continuously compounded zero rate -> discount factor: DF = exp(-z t). */
export function zeroCcToDF(z, t) {
    if (t < 0) throw new Error("t cannot be negative");
    if (t === 0) return 1;
    return Math.exp(-z * t);
}

/** Discount factor -> continuously compounded zero rate: z = -ln(DF) / t. */
export function dfToZeroCc(df, t) {
    if (df <= 0) throw new Error("DF must be positive");
    if (t <= 0) throw new Error("t must be positive");
    return -Math.log(df) / t;
}

/** Continuously compounded rate -> bond-equivalent (semiannual) yield. */
export function zeroCcToBEY(zCc) {
    return 2 * (Math.exp(zCc / 2) - 1);
}

/** Bond-equivalent (semiannual) yield -> continuously compounded rate. */
export function zeroBEYToCc(zBey) {
    if (1 + zBey / 2 <= 0) throw new Error("Invalid BEY");
    return 2 * Math.log(1 + zBey / 2);
}

/** Discount factor -> bond-equivalent zero yield. */
export function dfToZeroBEY(df, t) {
    return zeroCcToBEY(dfToZeroCc(df, t));
}

/** Bond-equivalent zero yield -> discount factor: 1 / (1 + y/2)^(2t). */
export function zeroBEYToDF(y, t) {
    if (t < 0) throw new Error("t cannot be negative");
    if (t === 0) return 1;
    if (1 + y / 2 <= 0) throw new Error("Invalid BEY");
    return 1 / Math.pow(1 + y / 2, 2 * t);
}

/** Discount factor -> simple annual rate: (1/DF - 1) * yearDays / days. */
export function dfToSimpleRate(df, days, yearDays) {
    if (df <= 0) throw new Error("DF must be positive");
    if (days <= 0) throw new Error("days must be positive");
    if (yearDays <= 0) throw new Error("yearDays must be positive");
    return (1 / df - 1) * yearDays / days;
}

/** Simple annual rate -> discount factor: 1 / (1 + r days/yearDays). */
export function simpleRateToDF(rate, days, yearDays) {
    if (days < 0) throw new Error("days cannot be negative");
    if (days === 0) return 1;
    if (yearDays <= 0) throw new Error("yearDays must be positive");
    return 1 / (1 + rate * days / yearDays);
}

/** Continuously compounded forward rate between t1 and t2: -ln(DF2/DF1) / (t2 - t1). */
export function forwardCcFromDF(df1, df2, t1, t2) {
    if (df1 <= 0 || df2 <= 0) throw new Error("Discount factors must be positive");
    if (t2 <= t1) throw new Error("t2 must be greater than t1");
    return -Math.log(df2 / df1) / (t2 - t1);
}

/** Forward discount factor from t1 to t2: DF2 / DF1. */
export function forwardDF(df1, df2) {
    if (df1 <= 0 || df2 <= 0) throw new Error("Discount factors must be positive");
    return df2 / df1;
}

/** Forward accumulation factor from t1 to t2: DF1 / DF2. */
export function forwardCarryFactor(df1, df2) {
    if (df1 <= 0 || df2 <= 0) throw new Error("Discount factors must be positive");
    return df1 / df2;
}
