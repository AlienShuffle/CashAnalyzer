import assert from "node:assert/strict";
import { yieldFromPrice } from "../../mktBonds/lib/yield.mjs";
import { accruedInterest, bondFacts } from "../../mktBonds/lib/coupons.mjs";
import { normalizeDate } from "../../mktBonds/lib/dates.mjs";
import { roundYield } from "../../mktBonds/lib/rounding.mjs";

export function referenceYield(settle, maturity, coupon, price) {
    assert.ok(Number.isFinite(price) && price > 0 && maturity > settle && coupon > 0, "Invalid reference yield input");
    const ordinary = yieldFromPrice(settle, maturity, coupon, price);
    if (Number.isFinite(ordinary)) return { value: ordinary, bracketed: false };
    const start = normalizeDate(settle), end = normalizeDate(maturity);
    const { w, N, schedule } = bondFacts(start, end);
    const dirty = price + accruedInterest(start, end, coupon, schedule);
    const pv = yieldValue => {
        let value = 0;
        for (let i = 0; i < N; i++) value += 100 * ((i === N - 1 ? 1 : 0) + coupon / 2)
            / (1 + yieldValue / 2) ** (w + i);
        return value;
    };
    let low = -1.99, high = 2;
    while (pv(low) < dirty && low > -2) low = (low - 2) / 2;
    while (pv(high) > dirty && high < 1e12) high *= 2;
    assert.ok(pv(low) >= dirty && pv(high) <= dirty, "Cannot bracket reference yield");
    for (let i = 0; i < 200; i++) {
        const middle = (low + high) / 2;
        if (pv(middle) > dirty) low = middle; else high = middle;
    }
    const value = (low + high) / 2;
    assert.ok(Math.abs(pv(value) - dirty) < 1e-7, "Reference yield did not converge");
    return { value: roundYield(value), bracketed: true };
}

export const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function grouped(rows, key) {
    const groups = new Map();
    for (const row of rows) {
        const id = key(row);
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(row);
    }
    return [...groups.values()];
}

export function episodeMeans(rows, fields) {
    const average = set => Object.fromEntries(fields.map(field => [field, mean(set.map(row => row[field]))]));
    return grouped(rows, row => row.event).map(episode => ({
        event: episode[0].event, state: episode[0].state, gapPp: episode[0].gapPp,
        ...average(grouped(episode, row => `${row.date}|${row.side}`).map(average)),
    }));
}

function slope(rows) {
    if (rows.length < 3) return null;
    const x = mean(rows.map(row => row.x)), y = mean(rows.map(row => row.y));
    const variance = rows.reduce((sum, row) => sum + (row.x - x) ** 2, 0);
    return variance > 0 ? rows.reduce((sum, row) => sum + (row.x - x) * (row.y - y), 0) / variance : null;
}

export function episodeInfluence(episodes, field) {
    assert.equal(new Set(episodes.map(row => row.event)).size, episodes.length, "Influence requires unique episodes");
    const rows = episodes.map(row => ({ x: row.gapPp, y: row[field] }));
    assert.ok(rows.every(row => Number.isFinite(row.x) && Number.isFinite(row.y)), "Nonfinite influence input");
    const fullSlope = slope(rows), fullMean = mean(rows.map(row => row.y));
    const center = mean(rows.map(row => row.x));
    const variance = rows.reduce((sum, row) => sum + (row.x - center) ** 2, 0);
    return episodes.map((episode, index) => {
        const rest = rows.filter((_, other) => other !== index);
        const withoutSlope = slope(rest), withoutMean = mean(rest.map(row => row.y));
        return {
            event: episode.event, state: episode.state, gapPp: episode.gapPp,
            episodeImprovement: episode[field], meanContribution: episode[field] / episodes.length,
            fullMean, withoutMean, meanChange: withoutMean == null ? null : withoutMean - fullMean,
            fullSlope, withoutSlope,
            slopeChange: withoutSlope == null || fullSlope == null ? null : withoutSlope - fullSlope,
            slopeFlips: fullSlope != null && withoutSlope != null && fullSlope * withoutSlope < 0,
            slopeContribution: variance > 0 ? (episode.gapPp - center) * (episode[field] - fullMean) / variance : null,
        };
    });
}

export function carryRelationship(episodes, field, iterations = 2000) {
    const rows = episodes.map(row => ({ x: row.gapPp, y: row[field] }));
    assert.ok(rows.every(row => Number.isFinite(row.x) && Number.isFinite(row.y)), "Nonfinite carry relationship input");
    const estimate = slope(rows);
    if (estimate == null) return { events: rows.length, slope: null, lower95: null, upper95: null, leaveOneOutMin: null, leaveOneOutMax: null };
    let seed = 1729;
    const values = [];
    for (let i = 0; i < iterations; i++) {
        const resample = Array.from({ length: rows.length }, () => {
            seed = (1664525 * seed + 1013904223) >>> 0;
            return rows[Math.floor(seed / 4294967296 * rows.length)];
        });
        const value = slope(resample);
        if (value != null) values.push(value);
    }
    assert.ok(values.length, "No identified carry bootstrap slopes");
    values.sort((a, b) => a - b);
    const leaveOneOut = rows.map((_, index) => slope(rows.filter((__, other) => other !== index))).filter(value => value != null);
    return {
        events: rows.length, slope: estimate,
        lower95: values[Math.floor((values.length - 1) * 0.025)],
        upper95: values[Math.ceil((values.length - 1) * 0.975)],
        leaveOneOutMin: leaveOneOut.length ? Math.min(...leaveOneOut) : null,
        leaveOneOutMax: leaveOneOut.length ? Math.max(...leaveOneOut) : null,
    };
}

export function forwardImprovement(settlement, forward) {
    assert.equal(settlement.cusip, forward.cusip);
    assert.equal(settlement.date, forward.date);
    assert.equal(settlement.side, forward.side);
    return {
        yieldImprovement: settlement.yieldError ** 2 - forward.yieldError ** 2,
        priceImprovement: settlement.priceError ** 2 - forward.priceError ** 2,
        signedYieldChange: forward.yieldError - settlement.yieldError,
        signedPriceChange: forward.priceError - settlement.priceError,
        unknownDays: settlement.unknownDays,
    };
}
