import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    analyzeTipsZero, dfToSimpleRate, dfToZeroBEY, dfToZeroCc, fitTipsSvensson, forwardCcFromDF, forwardCarryFactor,
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

test("fit requires at least 6 bonds and analysis reports a row per bond", () => {
    assert.throws(() => fitTipsSvensson(settle, bonds.slice(0, 3)), /at least 6/);
    const r = analyzeTipsZero(settle, bonds, { forward: "2027-10-05" });
    assert.equal(r.rows.length, bonds.length);
    assert.equal(r.params.length, 6);
    assert.ok(typeof r.forwardZero === "number");
    assert.ok(r.rows.every(x => Math.abs(x.priceResidual) < 1));
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
    const mine = fitTipsSvensson(settle, bonds);
    assert.deepEqual(Array.from(orig.params), mine.params);
    assert.equal(orig.objective, mine.objective);
    context.p = mine.params;
    for (const b of bonds) {
        context.b = { ...b, maturity: ds(b.maturity) };
        assert.equal(vm.runInContext("mytipsZeroModelPrice(inp.settle, b.maturity, b.coupon, p)", context),
            tipsZeroModelPrice(settle, b.maturity, b.coupon, mine.params));
    }
});
