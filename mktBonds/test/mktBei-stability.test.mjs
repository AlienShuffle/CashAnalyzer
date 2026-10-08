import test from "node:test";
import assert from "node:assert/strict";
import { accruedInterest } from "../lib/coupons.mjs";
import { svenssonZero, tipsZeroModelPrice } from "../lib/zero/index.mjs";
import { buildBeiStability, knownInflation, leaveOneOut, parseOptions, TENORS } from "../node-calc-mktBei-stability.mjs";

const realParams = [0.02, -0.01, 0.01, 0.005, 2, 8];
const nominalParams = [0.045, -0.005, 0.01, 0.01, 2, 8];
const zeroLoo = Object.fromEntries(TENORS.map(t => [String(t).replace(".", "_"), { maxBp: 1, impliedMaxBp: 2, cusip: "X" }]));

function curve(settleDate, params, residualBp = 1) {
    return {
        settleDate, params,
        rows: [["2027-07-15", residualBp], ["2028-01-15", -residualBp], ["2040-01-15", 0.5]]
            .map(([maturity, r]) => ({ cusip: maturity, maturity, coupon: 0.01, marketClean: 100, residualBp: r, priceResidual: r / 100 })),
    };
}

function snapshot(asOfDate, settleDate, forwardDate, { realShift = 0, side = "ask" } = {}) {
    const real = realParams.map((p, i) => (i === 0 ? p + realShift : p));
    const curves = {};
    for (const adjustment of ["sa", "sa-decay"]) {
        curves[adjustment] = { settle: curve(settleDate, real), forward: curve(forwardDate, real, 2) };
    }
    return {
        asOfDate, side,
        tipsRows: [{ settle_refcpi: 334.0, fwd_refcpi: 335.0, settle_mature_sa_ratio: 1.001, fwd_mature_sa_ratio: 1.0004 }],
        nominals: { settle: { settleDate, params: nominalParams }, forward: { settleDate: forwardDate, params: nominalParams } },
        curves,
    };
}

function cacheFor(snapshots) {
    const cache = {};
    for (const s of snapshots) for (const a of ["sa", "sa-decay"]) for (const v of ["settle", "forward"]) cache[`${s.asOfDate}|${s.side}|${a}|${v}`] = zeroLoo;
    return cache;
}

test("known inflation is the seasonally adjusted log REFCPI ratio from settlement to the forward date", () => {
    const rows = [{ settle_refcpi: 334.0, fwd_refcpi: 335.0, settle_mature_sa_ratio: 1.001, fwd_mature_sa_ratio: 1.0004 }];
    assert.ok(Math.abs(knownInflation(rows) - (Math.log(335 / 334) + Math.log(1.001 / 1.0004))) < 1e-12);
    assert.equal(knownInflation([{ settle_refcpi: 334 }]), null);
});

test("rows carry constant-maturity BEI and the settle BEI with known inflation removed", () => {
    const snapshots = [snapshot("2026-10-08T1235", "2026-10-09", "2026-11-01")];
    const { rows } = buildBeiStability(snapshots, { cache: cacheFor(snapshots) });
    assert.equal(rows.length, 4);
    const settle = rows.find(r => r.valuation === "settle" && r.adjustment === "sa");
    const forward = rows.find(r => r.valuation === "forward" && r.adjustment === "sa");
    const known = Math.log(335 / 334) + Math.log(1.001 / 1.0004);
    const gap = 23 / 365;
    for (const tenor of TENORS) {
        const k = String(tenor).replace(".", "_");
        const bei = t => svenssonZero(t, nominalParams) - svenssonZero(t, realParams);
        assert.ok(Math.abs(settle[`bei${k}y`] - bei(tenor)) < 1e-6);
        assert.ok(Math.abs(settle[`implied${k}y`] - (bei(gap + tenor) * (gap + tenor) - known) / tenor) < 1e-6);
        assert.equal(forward[`implied${k}y`], null);
        assert.equal(settle[`looImplied${k}yBp`], 2);
    }
    assert.equal(settle.shortBonds, 2);
    assert.equal(settle.knownInflation, Math.round(known * 1e6) / 1e6);
    assert.equal(forward.knownInflation, null);
});

test("summary compares forward with the settle-implied BEI, skips forward-date jumps and waits for history", () => {
    const snapshots = [
        snapshot("2026-10-06T1705", "2026-10-07", "2026-11-01"),
        snapshot("2026-10-07T0805", "2026-10-08", "2026-11-01", { realShift: 0.0005 }),
        snapshot("2026-10-08T1235", "2026-10-09", "2026-11-01"),
        snapshot("2026-10-15T1235", "2026-10-16", "2026-12-01", { realShift: 0.01 }),
    ];
    const result = buildBeiStability(snapshots, { minDays: 3, cache: cacheFor(snapshots) });
    const row = result.summary.find(r => r.side === "ask" && r.adjustment === "sa" && r.tenor === 1);
    assert.equal(row.days, 4);
    // The 10-15 snapshot moved the forward date, so only two day-to-day changes count.
    assert.equal(row.changes, 2);
    // A level shift of the real curve moves forward BEI by 5 bp, and the settle-implied BEI by
    // 5 bp scaled by (gap + tenor) / tenor, with a gap of about 24 days here, plus a little curve roll.
    assert.ok(Math.abs(row.forwardChangeBp - 5) < 0.01);
    assert.ok(row.impliedChangeBp > 5.25 && row.impliedChangeBp < 5.5, String(row.impliedChangeBp));
    assert.equal(row.stabler, "similar");
    assert.equal(row.robuster, "forward");
    assert.equal(row.fitter, "settle");
    assert.equal(buildBeiStability(snapshots, { minDays: 5, cache: cacheFor(snapshots) }).summary[0].stabler, "insufficient history");
});

test("leave-one-out barely moves a curve fitted to exact prices", () => {
    const settleDate = "2026-10-09";
    const rows = [2027, 2028, 2029, 2030, 2032, 2035, 2040, 2045, 2050, 2055].map(year => {
        const maturity = `${year}-07-15`;
        const marketClean = tipsZeroModelPrice(settleDate, maturity, 0.01, realParams) - accruedInterest(settleDate, maturity, 0.01);
        return { cusip: maturity, maturity, coupon: 0.01, marketClean };
    });
    const result = leaveOneOut({ settleDate, params: realParams, rows }, { shortYears: 3, gapYears: 23 / 365 });
    for (const entry of Object.values(result)) {
        assert.ok(entry.maxBp < 0.5 && entry.impliedMaxBp < 0.5, JSON.stringify(entry));
    }
});

test("stability options are validated", () => {
    assert.deepEqual(parseOptions(["--daily=/x", "--cache=/c", "--minDays=5"]), { daily: "/x", cache: "/c", shortYears: 3, minDays: 5 });
    assert.throws(() => parseOptions([]), /--daily/);
    assert.throws(() => parseOptions(["--daily=/x", "--minDays=1"]), /minDays/);
    assert.throws(() => parseOptions(["--x=1"]), /Unknown option/);
});
