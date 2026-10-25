import { checkedDate } from "./research-calendar.mjs";

export const SHORT_BUCKETS = [
    { id: "0-6m", lower: 0, upper: 6 },
    { id: "3-12m", lower: 3, upper: 12 },
    { id: "6-12m", lower: 6, upper: 12 },
];

function addMonths(value, months) {
    const date = new Date(checkedDate(value));
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, end));
    return date.toISOString().slice(0, 10);
}

export function inShortBucket(row, bucket) {
    const settle = checkedDate(row.settle), maturity = checkedDate(row.maturity), horizon = checkedDate(row.horizon);
    return maturity > horizon && maturity > addMonths(settle, bucket.lower) && maturity <= addMonths(settle, bucket.upper);
}

export function shortBucketMetrics(errors, bucket) {
    const rows = errors.filter(row => inShortBucket(row, bucket));
    const bei = rows.filter(row => row.bei != null);
    const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const mse = values => mean(values.map(value => value * value));
    const unknownDays = rows.map(row => (Date.parse(row.maturity) - Date.parse(row.horizon)) / 86400000);
    return {
        bonds: rows.length, beiBonds: bei.length,
        extrapolatedBonds: rows.filter(row => row.extrapolated).length,
        minimumUnknownDays: rows.length ? Math.min(...unknownDays) : null,
        maximumUnknownDays: rows.length ? Math.max(...unknownDays) : null,
        meanUnknownDays: mean(unknownDays),
        tipsMse: mse(rows.map(row => row.tips)),
        beiMse: mse(bei.map(row => row.bei)),
        priceMse: mse(rows.map(row => row.price)),
        interpolatedTipsMse: mse(rows.filter(row => !row.extrapolated).map(row => row.tips)),
    };
}
