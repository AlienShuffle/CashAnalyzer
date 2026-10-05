import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { accruedInterest } from "../lib/coupons.mjs";
import {
    analyzeTipsZero, dfToSimpleRate, dfToZeroBEY, dfToZeroCc, fitTipsSvensson, fitTipsSvenssonLegacy, forwardCcFromDF, forwardCarryFactor,
    forwardDF, simpleRateToDF, svenssonDF, svenssonZero, tipsZeroModelPrice, zeroBEYToCc, zeroBEYToDF, zeroCcToBEY,
    zeroCcToDF,
} from "../lib/index.mjs";

test("zero conversions round-trip", () => {
    assert.equal(zeroCcToDF(0.05, 0), 1);
    assert.ok(Math.abs(dfToZeroCc(zeroCcToDF(0.05, 3), 3) - 0.05) < 1e-12);
    assert.ok(Math.abs(zeroBEYToCc(zeroCcToBEY(0.05)) - 0.05) < 1e-12);
    assert.ok(Math.abs(dfToZeroBEY(zeroBEYToDF(0.04, 5), 5) - 0.04) < 1e-12);
    assert.ok(Math.abs(dfToSimpleRate(simpleRateToDF(0.04, 90, 365), 90, 365) - 0.04) < 1e-12);
    assert.ok(Math.abs(forwardCcFromDF(zeroCcToDF(0.04, 1), zeroCcToDF(0.04, 3), 1, 3) - 0.04) < 1e-12);
    assert.equal(forwardDF(0.5, 0.25) * forwardCarryFactor(0.5, 0.25), 1);
});

test("zero conversions validate inputs", () => {
    assert.throws(() => zeroCcToDF(0.05, -1), /negative/);
    assert.throws(() => dfToZeroCc(0, 1), /positive/);
    assert.throws(() => zeroBEYToCc(-2), /Invalid/);
    assert.throws(() => forwardCcFromDF(0.9, 0.8, 2, 1), /greater/);
});

test("svensson: flat curve and t<=0", () => {
    const p = [0.02, 0, 0, 0, 1.5, 6];
    assert.equal(svenssonZero(5, p), 0.02);
    assert.equal(svenssonZero(0, [0.02, -0.005, 0, 0, 1, 2]), 0.015);
    assert.ok(Math.abs(svenssonDF(2, p) - Math.exp(-0.04)) < 1e-12);
    const price = tipsZeroModelPrice("2026-10-05", "2029-04-15", 0.02, p);
    assert.ok(price > 95 && price < 105);
});

const settle = "2026-10-05";
const bonds = [
    ["2027-04-15", 0.0125, 99.6], ["2027-10-15", 0.01, 99.2], ["2028-07-15", 0.0075, 98.0],
    ["2029-01-15", 0.0125, 98.4], ["2030-07-15", 0.015, 97.9], ["2031-04-15", 0.0125, 96.5],
    ["2032-07-15", 0.02, 98.1], ["2035-01-15", 0.02, 96.0],
].map(([maturity, coupon, cleanPrice]) => ({ maturity, coupon, cleanPrice }));

test("fit requires at least 6 bonds and analysis reports a row per active bond", () => {
    assert.throws(() => fitTipsSvensson(settle, bonds.slice(0, 3)), /at least 6/);
    const r = analyzeTipsZero(settle, bonds);
    assert.deepEqual(Object.keys(r), ["params", "objective", "rows"]);
    assert.equal(r.rows.length, bonds.length);
    assert.equal(r.params.length, 6);
    assert.ok(r.rows.every(x => Math.abs(x.priceResidual) < 1));
});

test("TIPS zero analysis excludes bonds matured by settlement", () => {
    const matured = [
        { maturity: "2026-10-04", coupon: NaN, cleanPrice: 0 },
        { maturity: settle, coupon: NaN, cleanPrice: 0 },
    ];
    const r = analyzeTipsZero(settle, [...matured, ...bonds]);
    assert.equal(r.rows.length, bonds.length);
    assert.ok(r.rows.every(row => row.maturity > new Date(2026, 9, 5)));
});

test("parity with Apps Script svensson fit", () => {
    const dir = new URL("../appscript-src/", import.meta.url);
    const files = ["mybond.dates.js", "mybond.utils.js", "mybond.yieldFromPrice.js", "duration.js",
        "zero.conversions.js", "mybond.zero-coupon.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date, Array, Number });
    for (const file of files) vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    const ds = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    context.inp = { settle: ds(settle), bonds: bonds.map(b => ({ ...b, maturity: ds(b.maturity) })) };
    const orig = vm.runInContext("fitTipsSvensson_(inp.settle, inp.bonds)", context);
    const mine = fitTipsSvenssonLegacy(settle, bonds);
    assert.deepEqual(Array.from(orig.params), mine.params);
    assert.equal(orig.objective, mine.objective);
    context.p = mine.params;
    for (const b of bonds) {
        context.b = { ...b, maturity: ds(b.maturity) };
        assert.equal(vm.runInContext("mytipsZeroModelPrice(inp.settle, b.maturity, b.coupon, p)", context),
            tipsZeroModelPrice(settle, b.maturity, b.coupon, mine.params));
    }
});

test("optimized Svensson fit escapes the legacy local minimum", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const market = fixture.bonds.map(([maturity, coupon, cleanPrice]) => ({ maturity, coupon, cleanPrice }));
    const legacy = fitTipsSvenssonLegacy(fixture.settle, market);
    const fit = fitTipsSvensson(fixture.settle, market);
    assert.ok(fit.objective < legacy.objective * 0.6, `${fit.objective} vs ${legacy.objective}`);
    assert.ok(fit.objective < 0.72);
    assert.ok(fit.params[4] < fit.params[5]);
});

test("optimized Svensson fit reprices a synthetic curve", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const truth = [0.021, -0.006, 0.01, 0.015, 1.8, 9];
    const synthetic = fixture.bonds.map(([maturity, coupon]) => ({
        maturity,
        coupon,
        cleanPrice: tipsZeroModelPrice(fixture.settle, maturity, coupon, truth) - accruedInterest(fixture.settle, maturity, coupon),
    }));
    const fit = fitTipsSvensson(fixture.settle, synthetic);
    assert.ok(fit.objective < 1e-8, `${fit.objective}`);
});
